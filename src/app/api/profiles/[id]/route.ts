import { NextResponse } from 'next/server';
import { getProfile, updateProfile, deleteProfile } from '@/lib/services/profile.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const profile = await getProfile(Number(id));
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const profile = await updateProfile(Number(id), body);
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(profile);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const deleted = await deleteProfile(Number(id));
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
