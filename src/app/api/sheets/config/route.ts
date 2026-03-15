import { NextResponse } from 'next/server';
import { isConfigured } from '@/lib/sheets/google-sheets';

export async function GET() {
  return NextResponse.json({
    configured: isConfigured(),
    defaultSpreadsheetId: process.env.GOOGLE_SHEET_ID || '',
  });
}
