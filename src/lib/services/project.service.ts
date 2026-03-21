import { prisma } from '@/lib/prisma';
import { ProjectData, KeywordWithProducts, ProductData, KeywordResultData } from '@/types';

function toProjectData(row: {
  id: number;
  name: string;
  status: string;
  profileId: number;
  productsPerKeyword: number;
  randomProducts: boolean;
  randomMin: number;
  scrapeMode: string;
  concurrency: number;
  totalKeywords: number;
  completedKeywords: number;
  failedKeywords: number;
  elapsedMs: number;
  relevanceFilter: boolean;
  relevanceThreshold: number;
  relevanceStatus: string;
  relevanceDropped: number;
  relevanceProgress: number;
  relevanceTotal: number;
  relevanceError: string;
  createdAt: Date;
  updatedAt: Date;
}): ProjectData {
  return {
    id: row.id,
    name: row.name,
    status: row.status as ProjectData['status'],
    profileId: row.profileId,
    productsPerKeyword: row.productsPerKeyword,
    randomProducts: row.randomProducts,
    randomMin: row.randomMin,
    scrapeMode: row.scrapeMode as ProjectData['scrapeMode'],
    concurrency: row.concurrency,
    totalKeywords: row.totalKeywords,
    completedKeywords: row.completedKeywords,
    failedKeywords: row.failedKeywords,
    elapsedMs: row.elapsedMs || 0,
    relevanceFilter: row.relevanceFilter,
    relevanceThreshold: row.relevanceThreshold,
    relevanceStatus: row.relevanceStatus,
    relevanceDropped: row.relevanceDropped,
    relevanceProgress: row.relevanceProgress,
    relevanceTotal: row.relevanceTotal,
    relevanceError: row.relevanceError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toKeywordData(row: {
  id: number;
  projectId: number;
  keyword: string;
  productUrls: string | null;
  searchUrl: string;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
}): KeywordResultData {
  return {
    id: row.id,
    projectId: row.projectId,
    keyword: row.keyword,
    productUrls: row.productUrls ?? null,
    searchUrl: row.searchUrl,
    status: row.status as KeywordResultData['status'],
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProductData(row: {
  id: number;
  keywordResultId: number;
  title: string;
  asin: string;
  productUrl: string;
  affiliateUrl: string;
  imageUrl: string;
  featureBullets: string;
  productDescription: string;
  productFacts: string;
  techDetails: string;
  reviews: string;
  mergedText: string;
  scrapeDebug: string;
  position: number;
  excluded: boolean;
  createdAt: Date;
}): ProductData {
  return {
    id: row.id,
    keywordResultId: row.keywordResultId,
    title: row.title,
    asin: row.asin,
    productUrl: row.productUrl,
    affiliateUrl: row.affiliateUrl,
    imageUrl: row.imageUrl,
    featureBullets: row.featureBullets,
    productDescription: row.productDescription,
    productFacts: row.productFacts,
    techDetails: row.techDetails,
    reviews: row.reviews,
    mergedText: row.mergedText,
    scrapeDebug: row.scrapeDebug,
    position: row.position,
    excluded: row.excluded,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listProjects(): Promise<ProjectData[]> {
  const rows = await prisma.project.findMany({ orderBy: { id: 'desc' } });
  return rows.map(toProjectData);
}

export async function getProject(id: number): Promise<ProjectData | null> {
  const row = await prisma.project.findUnique({ where: { id } });
  return row ? toProjectData(row) : null;
}

export async function getProjectWithKeywords(id: number): Promise<{ project: ProjectData; keywords: KeywordWithProducts[] } | null> {
  const row = await prisma.project.findUnique({
    where: { id },
    include: {
      keywords: {
        orderBy: { id: 'asc' },
        include: {
          products: { orderBy: { position: 'asc' } },
        },
      },
    },
  });

  if (!row) return null;

  const project = toProjectData(row);
  const keywords: KeywordWithProducts[] = row.keywords.map((kw) => ({
    ...toKeywordData(kw),
    products: kw.products.map(toProductData),
  }));

  return { project, keywords };
}

export async function createProject(
  name: string,
  profileId: number,
  productsPerKeyword: number,
  keywords: Array<{ keyword: string; urls: string[] }>,
  options: { concurrency?: number; randomProducts?: boolean; randomMin?: number; scrapeMode?: string; relevanceFilter?: boolean; relevanceThreshold?: number } = {}
): Promise<ProjectData> {
  const row = await prisma.project.create({
    data: {
      name,
      profileId,
      productsPerKeyword,
      randomProducts: options.randomProducts ?? false,
      randomMin: options.randomMin ?? 5,
      scrapeMode: options.scrapeMode ?? 'full',
      concurrency: options.concurrency ?? 20,
      relevanceFilter: options.relevanceFilter ?? false,
      relevanceThreshold: options.relevanceThreshold ?? 50,
      relevanceStatus: options.relevanceFilter ? 'pending' : '',
      totalKeywords: keywords.length,
      keywords: {
        create: keywords.map(({ keyword, urls }) => ({
          keyword,
          productUrls: urls.length > 0 ? JSON.stringify(urls) : null,
        })),
      },
    },
  });
  return toProjectData(row);
}

export async function updateProjectStatus(id: number, status: string) {
  await prisma.project.update({ where: { id }, data: { status } });
}

export async function incrementProjectProgress(id: number, success: boolean) {
  if (success) {
    await prisma.project.update({ where: { id }, data: { completedKeywords: { increment: 1 } } });
  } else {
    await prisma.project.update({ where: { id }, data: { failedKeywords: { increment: 1 } } });
  }
}

export async function resetFailedKeywords(projectId: number) {
  await prisma.keywordResult.updateMany({
    where: { projectId, status: 'failed' },
    data: { status: 'pending', errorMessage: null },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { failedKeywords: 0, status: 'pending' },
  });
}

export async function getPendingKeywords(projectId: number) {
  return prisma.keywordResult.findMany({
    where: { projectId, status: 'pending' },
    orderBy: { id: 'asc' },
  });
}

export async function updateKeywordResult(
  id: number,
  data: { status?: string; searchUrl?: string; errorMessage?: string | null }
) {
  await prisma.keywordResult.update({ where: { id }, data });
}
