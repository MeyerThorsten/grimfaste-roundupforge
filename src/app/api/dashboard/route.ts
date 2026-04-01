import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const [projects, totals, recentProjects, dailyStats] = await Promise.all([
    // Overall counts
    prisma.project.groupBy({
      by: ['status'],
      _count: true,
    }),
    // Aggregate totals
    prisma.project.aggregate({
      _sum: { creditsUsed: true, totalKeywords: true, completedKeywords: true, failedKeywords: true, elapsedMs: true },
      _count: true,
    }),
    // Last 10 projects
    prisma.project.findMany({
      orderBy: { id: 'desc' },
      take: 10,
      select: {
        id: true, name: true, status: true, totalKeywords: true, completedKeywords: true,
        failedKeywords: true, creditsUsed: true, elapsedMs: true, createdAt: true,
        _count: { select: { keywords: true } },
      },
    }),
    // Projects per day (last 30 days)
    prisma.$queryRaw<{ day: string; count: number; credits: number; keywords: number }[]>`
      SELECT
        date(createdAt) as day,
        COUNT(*) as count,
        COALESCE(SUM(creditsUsed), 0) as credits,
        COALESCE(SUM(totalKeywords), 0) as keywords
      FROM Project
      WHERE createdAt >= datetime('now', '-30 days')
      GROUP BY date(createdAt)
      ORDER BY day DESC
    `,
  ]);

  // Product count
  const productCount = await prisma.product.count();

  // Status distribution
  const statusCounts: Record<string, number> = {};
  for (const p of projects) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + p._count;
  }

  // Success rate
  const totalProjects = totals._count;
  const completedCount = statusCounts['completed'] || 0;
  const failedCount = statusCounts['failed'] || 0;
  const finishedCount = completedCount + failedCount;
  const successRate = finishedCount > 0 ? Math.round((completedCount / finishedCount) * 100) : 0;

  // Average products per keyword
  const totalKeywords = totals._sum.totalKeywords || 0;
  const avgProductsPerKeyword = totalKeywords > 0 ? Math.round((productCount / totalKeywords) * 10) / 10 : 0;

  // Average time per project (completed only)
  const completedProjects = await prisma.project.findMany({
    where: { status: 'completed' },
    select: { elapsedMs: true, totalKeywords: true },
  });
  const avgTimePerProject = completedProjects.length > 0
    ? Math.round(completedProjects.reduce((sum, p) => sum + p.elapsedMs, 0) / completedProjects.length)
    : 0;
  const avgTimePerKeyword = completedProjects.length > 0
    ? Math.round(completedProjects.reduce((sum, p) => sum + (p.totalKeywords > 0 ? p.elapsedMs / p.totalKeywords : 0), 0) / completedProjects.length)
    : 0;

  // Export snapshots count
  const exportCount = await prisma.exportSnapshot.count();

  return NextResponse.json({
    overview: {
      totalProjects,
      totalKeywords,
      totalProducts: productCount,
      totalCredits: totals._sum.creditsUsed || 0,
      totalExports: exportCount,
      successRate,
      avgProductsPerKeyword,
      avgTimePerProject,
      avgTimePerKeyword,
    },
    statusCounts,
    recentProjects: recentProjects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      totalKeywords: p.totalKeywords,
      completedKeywords: p.completedKeywords,
      failedKeywords: p.failedKeywords,
      creditsUsed: p.creditsUsed,
      elapsedMs: p.elapsedMs,
      createdAt: p.createdAt.toISOString(),
    })),
    dailyStats: dailyStats.map((d) => ({
      day: d.day,
      count: Number(d.count),
      credits: Number(d.credits),
      keywords: Number(d.keywords),
    })),
  });
}
