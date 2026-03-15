import { NextResponse } from 'next/server';
import { getProjectWithKeywords } from '@/lib/services/project.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const result = await getProjectWithKeywords(Number(id));
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(result);
}
