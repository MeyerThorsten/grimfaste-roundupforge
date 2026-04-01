import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getProjectWithKeywords } from '@/lib/services/project.service';
import { getProfile } from '@/lib/services/profile.service';
import { prisma } from '@/lib/prisma';
import { toCSV } from '@/lib/export/csv';
import { toRoundup, toRoundupPacks } from '@/lib/export/roundup';
import { ProjectExport } from '@/types';

type Params = { params: Promise<{ id: string }> };

async function saveSnapshot(projectId: number, format: string, filename: string, content: string, productsCount: number) {
  const contentHash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  await prisma.exportSnapshot.create({
    data: { projectId, format, filename, contentHash, productsCount },
  });
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const projectId = Number(id);
  const result = await getProjectWithKeywords(projectId);
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const profile = await getProfile(result.project.profileId);
  const domain = profile?.domain || 'amazon.com';

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';

  // Filter excluded products
  const filteredKeywords = result.keywords.map((kw) => ({
    ...kw,
    products: kw.products.filter((p) => !p.excluded),
  }));

  const totalProducts = filteredKeywords.reduce((sum, kw) => sum + kw.products.length, 0);

  if (format === 'csv') {
    const csv = toCSV(filteredKeywords);
    const filename = `project-${projectId}.csv`;
    saveSnapshot(projectId, 'csv', filename, csv, totalProducts).catch(() => {});
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === 'roundup') {
    const packSize = parseInt(searchParams.get('pack') || '0', 10);

    if (!packSize || packSize <= 0) {
      const text = toRoundup(filteredKeywords, domain);
      const filename = `project-${projectId}-roundup.txt`;
      saveSnapshot(projectId, 'roundup', filename, text, totalProducts).catch(() => {});
      return new Response(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const packs = toRoundupPacks(filteredKeywords, packSize, domain);
    const packObjects = packs.map((content, i) => ({
      pack: i + 1,
      totalPacks: packs.length,
      filename: `roundup-pack-${i + 1}-of-${packs.length}.txt`,
      content,
    }));

    if (packObjects.length <= 1) {
      const text = packs[0] || '';
      const filename = `project-${projectId}-roundup.txt`;
      saveSnapshot(projectId, 'roundup', filename, text, totalProducts).catch(() => {});
      return new Response(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    saveSnapshot(projectId, 'roundup', `project-${projectId}-roundup-packs.json`, JSON.stringify(packObjects), totalProducts).catch(() => {});
    return NextResponse.json({ packs: packObjects });
  }

  const exportData: ProjectExport = {
    project: result.project,
    keywords: filteredKeywords,
  };
  const jsonStr = JSON.stringify(exportData);
  saveSnapshot(projectId, 'json', `project-${projectId}.json`, jsonStr, totalProducts).catch(() => {});
  return NextResponse.json(exportData);
}
