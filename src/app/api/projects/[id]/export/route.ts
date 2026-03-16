import { NextResponse } from 'next/server';
import { getProjectWithKeywords } from '@/lib/services/project.service';
import { toCSV } from '@/lib/export/csv';
import { toRoundup, toRoundupPacks } from '@/lib/export/roundup';
import { ProjectExport } from '@/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const result = await getProjectWithKeywords(Number(id));
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';

  // Filter excluded products
  const filteredKeywords = result.keywords.map((kw) => ({
    ...kw,
    products: kw.products.filter((p) => !p.excluded),
  }));

  if (format === 'csv') {
    const csv = toCSV(filteredKeywords);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="project-${result.project.id}.csv"`,
      },
    });
  }

  if (format === 'roundup') {
    const packSize = parseInt(searchParams.get('pack') || '0', 10);

    // No packing or everything fits in one pack → single file
    if (!packSize || packSize <= 0) {
      const text = toRoundup(filteredKeywords);
      return new Response(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="project-${result.project.id}-roundup.txt"`,
        },
      });
    }

    // Multiple packs → return JSON array of pack objects
    const packs = toRoundupPacks(filteredKeywords, packSize);
    const packObjects = packs.map((content, i) => ({
      pack: i + 1,
      totalPacks: packs.length,
      filename: `roundup-pack-${i + 1}-of-${packs.length}.txt`,
      content,
    }));

    // If only 1 pack, return as plain text
    if (packObjects.length <= 1) {
      const text = packs[0] || '';
      return new Response(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="project-${result.project.id}-roundup.txt"`,
        },
      });
    }

    return NextResponse.json({ packs: packObjects });
  }

  const exportData: ProjectExport = {
    project: result.project,
    keywords: filteredKeywords,
  };
  return NextResponse.json(exportData);
}
