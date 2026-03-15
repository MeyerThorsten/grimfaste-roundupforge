import { NextResponse } from 'next/server';
import { readKeywords, listTabs, isConfigured } from '@/lib/sheets/google-sheets';

export async function GET(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON env var.' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get('spreadsheetId') || process.env.GOOGLE_SHEET_ID || '';
  const tab = searchParams.get('tab') || 'Keywords';

  if (!spreadsheetId) {
    return NextResponse.json(
      { error: 'spreadsheetId query param or GOOGLE_SHEET_ID env var required' },
      { status: 400 }
    );
  }

  try {
    const result = await readKeywords(spreadsheetId, tab);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// List available tabs in a spreadsheet
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Google Sheets not configured' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const spreadsheetId = body.spreadsheetId || process.env.GOOGLE_SHEET_ID || '';

  if (!spreadsheetId) {
    return NextResponse.json({ error: 'spreadsheetId required' }, { status: 400 });
  }

  try {
    const tabs = await listTabs(spreadsheetId);
    return NextResponse.json({ tabs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
