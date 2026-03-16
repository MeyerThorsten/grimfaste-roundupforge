import { NextResponse } from 'next/server';
import { isConfigured, getSpreadsheetName } from '@/lib/sheets/google-sheets';

export async function GET() {
  const configured = isConfigured();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID || '';

  let sheetName = '';
  if (configured && spreadsheetId) {
    try {
      sheetName = await getSpreadsheetName(spreadsheetId);
    } catch {
      // Ignore — sheet may not be shared yet
    }
  }

  return NextResponse.json({
    configured,
    defaultSpreadsheetId: spreadsheetId,
    sheetName,
  });
}
