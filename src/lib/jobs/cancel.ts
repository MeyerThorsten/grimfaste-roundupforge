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
