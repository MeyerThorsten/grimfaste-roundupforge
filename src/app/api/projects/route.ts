import { NextResponse } from 'next/server';
import { createProject, listProjects, enqueueProject } from '@/lib/services/project.service';
import { getProfile } from '@/lib/services/profile.service';
import { processQueue, recoverQueue } from '@/lib/jobs/queue-processor';

import { CreateProjectPayload } from '@/types';

export async function GET() {
  // Recover queue on first access after server restart, then process
  await recoverQueue();
  processQueue().catch(console.error);
  const projects = await listProjects();
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateProjectPayload;

  if (!body.keywords || !Array.isArray(body.keywords) || body.keywords.length === 0) {
    return NextResponse.json({ error: 'keywords is required and must be a non-empty array' }, { status: 400 });
  }

  if (body.keywords.length > 10000) {
    return NextResponse.json({ error: 'Maximum 10,000 keywords allowed' }, { status: 400 });
  }

  // Validate each entry has a keyword
  for (const entry of body.keywords) {
    if (!entry.keyword || typeof entry.keyword !== 'string' || !entry.keyword.trim()) {
      return NextResponse.json({ error: 'Each keyword entry must have a non-empty keyword' }, { status: 400 });
    }
  }

  if (!body.profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  const profile = await getProfile(body.profileId);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const keywords = body.keywords
    .map((entry) => ({
      keyword: entry.keyword.trim(),
      urls: Array.isArray(entry.urls) ? entry.urls.filter((u) => typeof u === 'string' && u.trim()) : [],
    }))
    .filter((entry) => entry.keyword);

  if (keywords.length === 0) {
    return NextResponse.json({ error: 'No valid keywords provided' }, { status: 400 });
  }

  const productsPerKeyword = Math.min(15, Math.max(3, body.productsPerKeyword || 5));
  const concurrency = Math.min(45, Math.max(1, body.concurrency || 20));
  const name = body.name || keywords[0].keyword.slice(0, 60);

  try {
    const sheetsSpreadsheetId = (body as unknown as Record<string, unknown>).sheetsSpreadsheetId as string | undefined;
    const project = await createProject(name, body.profileId, productsPerKeyword, keywords, {
      concurrency,
      randomProducts: body.randomProducts ?? false,
      randomMin: Math.min(body.randomMin || 5, productsPerKeyword),
      scrapeMode: body.scrapeMode === 'fast' ? 'fast' : 'full',
      relevanceFilter: body.relevanceFilter ?? false,
      relevanceThreshold: Math.min(100, Math.max(0, body.relevanceThreshold || 50)),
      sheetsSpreadsheetId: sheetsSpreadsheetId || '',
    });

    // Auto-queue and start processing
    await enqueueProject(project.id);
    processQueue().catch(console.error);

    return NextResponse.json({ ...project, status: 'queued' }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create project' },
      { status: 500 }
    );
  }
}
