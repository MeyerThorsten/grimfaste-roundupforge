import { NextResponse } from 'next/server';
import { getProjectWithKeywords } from '@/lib/services/project.service';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const result = await getProjectWithKeywords(Number(id));
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(result);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const updated = await prisma.project.update({
      where: { id: Number(id) },
      data: { name: body.name.trim() },
    });
    return NextResponse.json({ ok: true, name: updated.name });
  } catch {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
}
