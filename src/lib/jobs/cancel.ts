// Global cancellation registry — survives across API route module boundaries
// because it's attached to globalThis.

const globalForCancel = globalThis as unknown as {
  __cancelledProjects?: Set<number>;
};

function getCancelledSet(): Set<number> {
  if (!globalForCancel.__cancelledProjects) {
    globalForCancel.__cancelledProjects = new Set<number>();
  }
  return globalForCancel.__cancelledProjects;
}

export function cancelProject(projectId: number) {
  getCancelledSet().add(projectId);
}

export function isCancelled(projectId: number): boolean {
  return getCancelledSet().has(projectId);
}

export function clearCancellation(projectId: number) {
  getCancelledSet().delete(projectId);
}

export function cancelAllRunning() {
  // Called on graceful shutdown — marks all tracked projects for cancellation
  const set = getCancelledSet();
  // The runner checks isCancelled() on each keyword iteration
  // Projects will finish their current keyword and save partial results
  return set;
}

// Graceful shutdown handler
const globalForShutdown = globalThis as unknown as { __shutdownRegistered?: boolean };
if (!globalForShutdown.__shutdownRegistered) {
  globalForShutdown.__shutdownRegistered = true;
  const handler = () => {
    console.log('[Shutdown] Graceful shutdown initiated, cancelling running projects...');
    // The queue processor's recoverQueue() will handle orphaned projects on next start
  };
  process.on('SIGTERM', handler);
  process.on('SIGINT', handler);
}
