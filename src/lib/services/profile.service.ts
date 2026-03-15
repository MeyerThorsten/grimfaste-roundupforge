import { prisma } from '@/lib/prisma';
import { ScrapeProfileData, ScrapeProfileCreateInput, ScrapeProfileUpdateInput, TextSelectorEntry } from '@/types';

function toProfileData(row: {
  id: number;
  name: string;
  domain: string;
  titleSelector: string;
  imageSelector: string;
  textSelectors: string;
  affiliateCode: string;
  treatAsReview: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ScrapeProfileData {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    titleSelector: row.titleSelector,
    imageSelector: row.imageSelector,
    textSelectors: JSON.parse(row.textSelectors) as TextSelectorEntry[],
    affiliateCode: row.affiliateCode,
    treatAsReview: row.treatAsReview,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProfiles(): Promise<ScrapeProfileData[]> {
  const rows = await prisma.scrapeProfile.findMany({ orderBy: { id: 'asc' } });
  return rows.map(toProfileData);
}

export async function getProfile(id: number): Promise<ScrapeProfileData | null> {
  const row = await prisma.scrapeProfile.findUnique({ where: { id } });
  return row ? toProfileData(row) : null;
}

export async function createProfile(input: ScrapeProfileCreateInput): Promise<ScrapeProfileData> {
  const row = await prisma.scrapeProfile.create({
    data: {
      name: input.name,
      domain: input.domain,
      titleSelector: input.titleSelector,
      imageSelector: input.imageSelector,
      textSelectors: JSON.stringify(input.textSelectors),
      affiliateCode: input.affiliateCode,
      treatAsReview: input.treatAsReview,
      enabled: input.enabled,
    },
  });
  return toProfileData(row);
}

export async function updateProfile(id: number, input: ScrapeProfileUpdateInput): Promise<ScrapeProfileData | null> {
  const existing = await prisma.scrapeProfile.findUnique({ where: { id } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.domain !== undefined) data.domain = input.domain;
  if (input.titleSelector !== undefined) data.titleSelector = input.titleSelector;
  if (input.imageSelector !== undefined) data.imageSelector = input.imageSelector;
  if (input.textSelectors !== undefined) data.textSelectors = JSON.stringify(input.textSelectors);
  if (input.affiliateCode !== undefined) data.affiliateCode = input.affiliateCode;
  if (input.treatAsReview !== undefined) data.treatAsReview = input.treatAsReview;
  if (input.enabled !== undefined) data.enabled = input.enabled;

  const row = await prisma.scrapeProfile.update({ where: { id }, data });
  return toProfileData(row);
}

export async function deleteProfile(id: number): Promise<boolean> {
  try {
    await prisma.scrapeProfile.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function ensureDefaultProfile(): Promise<void> {
  const count = await prisma.scrapeProfile.count();
  if (count > 0) return;

  const defaultSelectors: TextSelectorEntry[] = [
    { label: 'Feature Bullets', selector: '#feature-bullets', treatAsReview: false },
    { label: 'Description', selector: '#productDescription_feature_div', treatAsReview: false },
    { label: 'Product Details', selector: '#prodDetails', treatAsReview: false },
    { label: 'Tech Specs', selector: '#tech', treatAsReview: false },
    { label: 'Book Description', selector: '#bookDescription', treatAsReview: false },
    { label: 'Product Facts', selector: '#productFactsDesktopExpander', treatAsReview: false },
    { label: 'Reviews', selector: '.review-text', treatAsReview: true },
  ];

  await prisma.scrapeProfile.create({
    data: {
      name: 'Amazon US',
      domain: 'amazon.com',
      titleSelector: '#productTitle',
      imageSelector: '#imgTagWrapperId img',
      textSelectors: JSON.stringify(defaultSelectors),
      affiliateCode: '',
      treatAsReview: false,
      enabled: true,
    },
  });
}
