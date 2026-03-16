import { NextResponse } from 'next/server';
import { createProject, listProjects } from '@/lib/services/project.service';
import { getProfile } from '@/lib/services/profile.service';
import { CreateProjectPayload } from '@/types';

export async function GET() {
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

  if (!body.profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  const profile = await getProfile(body.profileId);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const keywords = body.keywords.map((k) => k.trim()).filter(Boolean);
  if (keywords.length === 0) {
    return NextResponse.json({ error: 'No valid keywords provided' }, { status: 400 });
  }

  const productsPerKeyword = Math.min(15, Math.max(3, body.productsPerKeyword || 5));
  const concurrency = Math.min(25, Math.max(1, body.concurrency || 20));
  const name = body.name || keywords[0].slice(0, 60);

  const project = await createProject(name, body.profileId, productsPerKeyword, keywords, {
    concurrency,
    randomProducts: body.randomProducts ?? false,
    scrapeMode: body.scrapeMode === 'fast' ? 'fast' : 'full',
  });
  return NextResponse.json(project, { status: 201 });
}
