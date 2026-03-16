import { google, sheets_v4 } from 'googleapis';
import { logger } from '@/lib/utils/logger';
import { KeywordWithProducts } from '@/types';

let sheetsClient: sheets_v4.Sheets | null = null;

function getCredentials(): { client_email: string; private_key: string } {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set. ' +
      'Set it to the full JSON contents of your service account key file.'
    );
  }
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
}

function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const creds = getCredentials();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

// ── Read keywords from a sheet ──────────────────────────────────

export interface SheetKeywordsResult {
  keywords: string[];
  sheetTitle: string;
  range: string;
}

/**
 * Read keywords from column A of a given sheet tab.
 * @param spreadsheetId - The Google Sheet ID (from the URL)
 * @param tabName - The tab/sheet name to read from (default: "Keywords")
 */
export async function readKeywords(
  spreadsheetId: string,
  tabName = ''
): Promise<SheetKeywordsResult> {
  const sheets = getSheetsClient();

  // If no tab specified, use the first tab in the spreadsheet
  if (!tabName) {
    const tabs = await listTabs(spreadsheetId);
    tabName = tabs[0] || 'Sheet1';
  }

  const range = `'${tabName}'!A:A`;

  logger.info('Reading keywords from Google Sheet', { spreadsheetId, range });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values || [];
  // Skip header row if it looks like a header
  const startIdx = rows.length > 0 && rows[0][0]?.toLowerCase().includes('keyword') ? 1 : 0;

  const keywords = rows
    .slice(startIdx)
    .map((row) => (row[0] || '').toString().trim())
    .filter(Boolean);

  logger.info('Read keywords from Google Sheet', { count: keywords.length });

  return {
    keywords,
    sheetTitle: tabName,
    range,
  };
}

// ── Write results to a sheet ────────────────────────────────────

const RESULT_HEADERS = [
  'Keyword',
  'Position',
  'Title',
  'ASIN',
  'Product URL',
  'Affiliate URL',
  'Image URL',
  'Feature Bullets',
  'Product Description',
  'Product Facts',
  'Tech Details',
  'Reviews',
  'Merged Text',
  'Status',
  'Search URL',
];

/**
 * Write project results to a new tab in the spreadsheet.
 * Creates a new tab named after the project. If it already exists, clears and overwrites.
 */
export async function writeResults(
  spreadsheetId: string,
  projectName: string,
  keywords: KeywordWithProducts[]
): Promise<{ tabName: string; rowsWritten: number }> {
  const sheets = getSheetsClient();

  // Sanitize tab name (max 100 chars, no special chars that Sheets doesn't allow)
  const tabName = projectName
    .replace(/[\\/*?[\]:]/g, '')
    .slice(0, 100) || 'Results';

  logger.info('Writing results to Google Sheet', { spreadsheetId, tabName });

  // Try to find existing tab, create if not found
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTab = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === tabName
  );

  if (existingTab) {
    // Clear existing tab
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tabName}!A:Z`,
    });
  } else {
    // Create new tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: tabName },
            },
          },
        ],
      },
    });
  }

  // Build rows
  const rows: (string | number)[][] = [RESULT_HEADERS];

  for (const kw of keywords) {
    if (kw.products.length === 0) {
      // Write a row for the keyword even with no products
      rows.push([
        kw.keyword,
        '', '', '', '', '', '', '', '', '', '', '', '',
        kw.status,
        kw.searchUrl,
      ]);
      continue;
    }

    for (const p of kw.products.filter((p) => !p.excluded)) {
      rows.push([
        kw.keyword,
        p.position,
        p.title,
        p.asin,
        p.productUrl,
        p.affiliateUrl,
        p.imageUrl,
        p.featureBullets,
        p.productDescription,
        p.productFacts,
        p.techDetails,
        p.reviews,
        p.mergedText,
        kw.status,
        kw.searchUrl,
      ]);
    }
  }

  // Write all rows
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  // Auto-resize columns and freeze header row
  const tabId = await getTabId(sheets, spreadsheetId, tabName);
  if (tabId !== null) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: tabId,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: tabId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: Math.min(RESULT_HEADERS.length, 7), // Only auto-resize first 7 cols
              },
            },
          },
        ],
      },
    });
  }

  const rowsWritten = rows.length - 1; // exclude header
  logger.info('Wrote results to Google Sheet', { tabName, rowsWritten });

  return { tabName, rowsWritten };
}

// ── Write keyword status updates ────────────────────────────────

/**
 * Write a summary/status sheet with keyword-level progress.
 */
export async function writeStatusSheet(
  spreadsheetId: string,
  projectName: string,
  keywords: KeywordWithProducts[]
): Promise<void> {
  const sheets = getSheetsClient();
  const tabName = `${projectName.replace(/[\\/*?[\]:]/g, '').slice(0, 90)} - Status`;

  // Create or clear tab
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTab = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === tabName
  );

  if (existingTab) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tabName}!A:Z`,
    });
  } else {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }

  const rows: (string | number)[][] = [
    ['Keyword', 'Status', 'Products Found', 'Products Excluded', 'Search URL', 'Error'],
  ];

  for (const kw of keywords) {
    const included = kw.products.filter((p) => !p.excluded).length;
    const excluded = kw.products.filter((p) => p.excluded).length;
    rows.push([
      kw.keyword,
      kw.status,
      included,
      excluded,
      kw.searchUrl,
      kw.errorMessage || '',
    ]);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

// ── List available tabs ─────────────────────────────────────────

export async function listTabs(spreadsheetId: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  return (
    spreadsheet.data.sheets?.map((s) => s.properties?.title || '') || []
  ).filter(Boolean);
}

// ── Check if Google Sheets is configured ────────────────────────

export function isConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

// ── Get spreadsheet title ───────────────────────────────────────

export async function getSpreadsheetName(spreadsheetId: string): Promise<string> {
  const sheets = getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties.title',
  });
  return spreadsheet.data.properties?.title || '';
}

// ── Helper ──────────────────────────────────────────────────────

async function getTabId(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<number | null> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === tabName
  );
  return tab?.properties?.sheetId ?? null;
}
