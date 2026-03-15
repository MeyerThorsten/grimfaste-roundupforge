import { NextResponse } from 'next/server';
import { getProjectWithKeywords } from '@/lib/services/project.service';
import { toCSV } from '@/lib/export/csv';
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

  const exportData: ProjectExport = {
    project: result.project,
    keywords: filteredKeywords,
  };
  return NextResponse.json(exportData);
}
