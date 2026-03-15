import { NextResponse } from 'next/server';
import { getProjectWithKeywords } from '@/lib/services/project.service';
import { writeResults, writeStatusSheet, isConfigured } from '@/lib/sheets/google-sheets';

export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON env var.' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const projectId = Number(body.projectId);
  const spreadsheetId = body.spreadsheetId || process.env.GOOGLE_SHEET_ID || '';

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  if (!spreadsheetId) {
    return NextResponse.json(
      { error: 'spreadsheetId required in body or GOOGLE_SHEET_ID env var' },
      { status: 400 }
    );
  }

  const result = await getProjectWithKeywords(projectId);
  if (!result) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    // Write both results tab and status tab
    const [resultsInfo] = await Promise.all([
      writeResults(spreadsheetId, result.project.name, result.keywords),
      writeStatusSheet(spreadsheetId, result.project.name, result.keywords),
    ]);

    return NextResponse.json({
      ok: true,
      spreadsheetId,
      tabName: resultsInfo.tabName,
      rowsWritten: resultsInfo.rowsWritten,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
