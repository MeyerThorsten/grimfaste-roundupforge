import { NextResponse } from 'next/server';
import { getProject } from '@/lib/services/project.service';
import { runProject } from '@/lib/jobs/runner';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const projectId = Number(id);

  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const retryOnly = Boolean(body.retryOnly);
  const sheetsSpreadsheetId = body.sheetsSpreadsheetId as string | undefined;

  // Fire and forget — runs in background, progress written to DB
  runProject(projectId, retryOnly, sheetsSpreadsheetId).catch((err) => {
    console.error('Project runner error:', err);
  });

  return NextResponse.json({ ok: true, projectId, retryOnly });
}
