import { NextResponse } from 'next/server';
import { listProfiles, createProfile, ensureDefaultProfile } from '@/lib/services/profile.service';

export async function GET() {
  await ensureDefaultProfile();
  const profiles = await listProfiles();
  return NextResponse.json(profiles);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, domain, titleSelector, imageSelector, textSelectors, affiliateCode, treatAsReview, enabled } = body;

  if (!name || !domain || !titleSelector || !imageSelector || !textSelectors) {
    return NextResponse.json({ error: 'Missing required fields: name, domain, titleSelector, imageSelector, textSelectors' }, { status: 400 });
  }

  const profile = await createProfile({
    name,
    domain,
    titleSelector,
    imageSelector,
    textSelectors,
    affiliateCode: affiliateCode || '',
    treatAsReview: treatAsReview || false,
    enabled: enabled !== false,
  });

  return NextResponse.json(profile, { status: 201 });
}
