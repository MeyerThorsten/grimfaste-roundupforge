/**
 * Queue processor — ensures projects run sequentially.
 * Uses globalThis singleton pattern (like cancel.ts).
 */

import { logger } from '@/lib/utils/logger';
import { getNextQueued, isAnyProjectRunning, updateProjectStatus } from '@/lib/services/project.service';
import { prisma } from '@/lib/prisma';

const globalForQueue = globalThis as unknown as {
  __queueProcessing?: boolean;
  __queueRecovered?: boolean;
};

/**
 * Process the queue: if no project is currently running, start the next queued one.
 * Called after project creation (enqueue) and after project completion.
 */
export async function processQueue() {
  if (globalForQueue.__queueProcessing) {
    logger.info('Queue: already processing, skipping');
    return;
  }
  globalForQueue.__queueProcessing = true;

  try {
    // Check if any project is currently running (from queue — retries bypass this)
    const running = await isAnyProjectRunning();
    if (running) {
      logger.info('Queue: a project is already running, waiting');
      return;
    }

    const next = await getNextQueued();
    if (!next) {
      logger.info('Queue: no queued projects');
      return;
    }

    logger.info('Queue: starting next project', { projectId: next.id, name: next.name });

    // Apply global max concurrency cap
    const maxConcurrency = parseInt(process.env.MAX_CONCURRENCY || '45', 10);
    const effectiveConcurrency = Math.min(next.concurrency, maxConcurrency);
    if (effectiveConcurrency !== next.concurrency) {
      await prisma.project.update({
        where: { id: next.id },
        data: { concurrency: effectiveConcurrency },
      });
    }

    // Import runner dynamically to avoid circular deps
    const { runProject } = await import('@/lib/jobs/runner');

    // Fire and forget — runner will call processQueue() again on completion
    runProject(next.id).catch((err) => {
      logger.error('Queue: runner error', { projectId: next.id, error: String(err) });
    });
  } catch (err) {
    logger.error('Queue processor error', { error: String(err) });
  } finally {
    globalForQueue.__queueProcessing = false;
  }
}

/**
 * Recover from server restart: mark orphaned "running" projects as failed,
 * then process the queue. Called once on first import.
 */
export async function recoverQueue() {
  if (globalForQueue.__queueRecovered) return;
  globalForQueue.__queueRecovered = true;

  try {
    // Find projects that were running when the server died
    const orphaned = await prisma.project.findMany({
      where: {
        OR: [
          { status: 'running' },
          { status: { startsWith: 'retrying' } },
        ],
      },
    });

    for (const p of orphaned) {
      logger.warn('Queue: recovering orphaned project', { projectId: p.id, status: p.status });
      await updateProjectStatus(p.id, 'failed');
    }

    if (orphaned.length > 0) {
      logger.info('Queue: recovered orphaned projects, processing queue', { count: orphaned.length });
    }

    await processQueue();
  } catch (err) {
    logger.error('Queue recovery error', { error: String(err) });
  }
}
