import { NextResponse } from 'next/server';
import { createProject, enqueueProject } from '@/lib/services/project.service';
import { getProfile } from '@/lib/services/profile.service';
import { processQueue } from '@/lib/jobs/queue-processor';
import { readKeywords, listTabs } from '@/lib/sheets/google-sheets';

export async function POST(request: Request) {
  const body = await request.json();
  const { spreadsheetId, tabNames, profileId, productsPerKeyword = 15, concurrency = 20, randomProducts = true, randomMin = 7, scrapeMode = 'fast' } = body;

  if (!spreadsheetId) {
    return NextResponse.json({ error: 'spreadsheetId is required' }, { status: 400 });
  }
  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  const profile = await getProfile(profileId);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Get tabs to process
  let tabs: string[];
  if (tabNames && Array.isArray(tabNames) && tabNames.length > 0) {
    tabs = tabNames;
  } else {
    tabs = await listTabs(spreadsheetId);
  }

  if (tabs.length === 0) {
    return NextResponse.json({ error: 'No tabs found in spreadsheet' }, { status: 400 });
  }

  const results: { tab: string; projectId?: number; keywords?: number; error?: string }[] = [];

  for (const tab of tabs) {
    try {
      const data = await readKeywords(spreadsheetId, tab);
      if (data.keywords.length === 0) {
        results.push({ tab, error: 'No keywords found' });
        continue;
      }

      const keywordGroups = data.keywords.map((kw) => ({ keyword: kw, urls: [] as string[] }));
      const cappedProducts = Math.min(15, Math.max(3, productsPerKeyword));
      const cappedConcurrency = Math.min(45, Math.max(1, concurrency));

      const project = await createProject(tab, profileId, cappedProducts, keywordGroups, {
        concurrency: cappedConcurrency,
        randomProducts,
        randomMin: Math.min(randomMin, cappedProducts),
        scrapeMode: scrapeMode === 'fast' ? 'fast' : 'full',
        sheetsSpreadsheetId: spreadsheetId,
      });

      await enqueueProject(project.id);
      results.push({ tab, projectId: project.id, keywords: data.keywords.length });
    } catch (err) {
      results.push({ tab, error: err instanceof Error ? err.message : 'Failed' });
    }
  }

  // Start processing the queue
  processQueue().catch(console.error);

  const queued = results.filter((r) => r.projectId).length;
  return NextResponse.json({ queued, total: tabs.length, results }, { status: 201 });
}
