import { NextResponse } from 'next/server';
import { getProject, dequeueProject } from '@/lib/services/project.service';
import { cancelProject } from '@/lib/jobs/cancel';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const projectId = Number(id);

  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Queued projects: just dequeue (no cancellation needed)
  if (project.status === 'queued') {
    await dequeueProject(projectId);
    return NextResponse.json({ ok: true, projectId, dequeued: true });
  }

  if (project.status !== 'running' && !project.status.startsWith('retrying') && project.status !== 'pending') {
    return NextResponse.json({ error: 'Project is not running' }, { status: 400 });
  }

  cancelProject(projectId);
  return NextResponse.json({ ok: true, projectId });
}
