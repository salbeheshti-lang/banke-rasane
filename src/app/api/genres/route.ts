import { NextResponse } from 'next/server';
import { prisma, ensureSeedData } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSeedData();
    
    const genres = await prisma.genre.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { programs: true },
        },
      },
    });
    
    return NextResponse.json({ genres });
  } catch (error) {
    console.error('[api/genres] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch genres', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
