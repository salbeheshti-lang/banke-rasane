import { NextResponse } from 'next/server';
import { prisma, ensureSeedData } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSeedData();
    
    const [totalPrograms, totalGenres, totalViewers, programs] = await Promise.all([
      prisma.program.count(),
      prisma.genre.count(),
      prisma.program.aggregate({ _sum: { viewersCount: true } }),
      prisma.program.findMany({ select: { hasImages: true } }),
    ]);
    
    const withImages = programs.filter(p => p.hasImages).length;
    
    return NextResponse.json({
      totalPrograms,
      totalGenres,
      totalViewers: totalViewers._sum.viewersCount || 0,
      withImages,
      withoutViewers: totalPrograms - (await prisma.program.count({ where: { viewersCount: { gt: 0 } } })),
    });
  } catch (error) {
    console.error('[api/stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
