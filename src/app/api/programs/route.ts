import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureSeedData } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await ensureSeedData();
    
    const { searchParams } = new URL(request.url);
    const genreId = searchParams.get('genreId');
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // all, without-viewers, with-viewers, with-images
    const sort = searchParams.get('sort') || 'newest'; // newest, oldest, title, viewers
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Build where clause
    const where: any = {};
    
    if (genreId && genreId !== 'all') {
      where.genreId = parseInt(genreId);
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { titleEn: { contains: search } },
        { description: { contains: search } },
        { producer: { contains: search } },
        { director: { contains: search } },
        { presenter: { contains: search } },
      ];
    }
    
    switch (filter) {
      case 'without-viewers':
        where.OR = [
          { viewersCount: 0 },
          { viewersCount: null },
        ];
        break;
      case 'with-viewers':
        where.viewersCount = { gt: 0 };
        break;
      case 'with-images':
        where.hasImages = true;
        break;
    }
    
    // Build order by
    let orderBy: any = { createdAt: 'desc' };
    switch (sort) {
      case 'oldest': orderBy = { createdAt: 'asc' }; break;
      case 'title': orderBy = { title: 'asc' }; break;
      case 'viewers': orderBy = { viewersCount: 'desc' }; break;
      case 'newest':
      default: orderBy = { createdAt: 'desc' };
    }
    
    const [programs, total] = await Promise.all([
      prisma.program.findMany({
        where,
        include: { genre: true },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.program.count({ where }),
    ]);
    
    return NextResponse.json({
      programs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[api/programs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch programs', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
