import { getProjectWithKeywords } from '@/lib/services/project.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const projectId = Number(id);

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Poll every 2 seconds and send updates
      const poll = async () => {
        while (!closed) {
          try {
            const result = await getProjectWithKeywords(projectId);
            if (!result) {
              send({ error: 'Project not found' });
              break;
            }

            const { project } = result;
            send({
              status: project.status,
              completedKeywords: project.completedKeywords,
              failedKeywords: project.failedKeywords,
              totalKeywords: project.totalKeywords,
              elapsedMs: project.elapsedMs,
              creditsUsed: project.creditsUsed,
              relevanceStatus: project.relevanceStatus,
              relevanceProgress: project.relevanceProgress,
              relevanceTotal: project.relevanceTotal,
            });

            // Stop streaming when project is done
            if (project.status === 'completed' || project.status === 'failed') {
              // Send one final update then close
              await new Promise((r) => setTimeout(r, 1000));
              break;
            }
          } catch {
            break;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        if (!closed) {
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        }
      };

      poll();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
