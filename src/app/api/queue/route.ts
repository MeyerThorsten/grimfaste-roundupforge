import { NextResponse } from 'next/server';
import { getQueueStatus } from '@/lib/services/project.service';
import { recoverQueue, processQueue } from '@/lib/jobs/queue-processor';

export async function GET() {
  // Recover on first access after server restart, then process queue
  await recoverQueue();
  await processQueue();
  const status = await getQueueStatus();
  return NextResponse.json(status);
}
