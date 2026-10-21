import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureSeedData } from '@/lib/prisma';
import { generateProgramsExcel } from '@/lib/export-excel';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await ensureSeedData();
    
    const body = await request.json();
    const { genreId, search, filter, sort, ids } = body;
    
    const where: any = {};
    
    if (ids && Array.isArray(ids) && ids.length > 0) {
      where.id = { in: ids };
    } else {
      if (genreId && genreId !== 'all') {
        where.genreId = parseInt(genreId);
      }
      
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { description: { contains: search } },
        ];
      }
      
      switch (filter) {
        case 'without-viewers':
          where.OR = [{ viewersCount: 0 }, { viewersCount: null }];
          break;
        case 'with-viewers':
          where.viewersCount = { gt: 0 };
          break;
        case 'with-images':
          where.hasImages = true;
          break;
      }
    }
    
    let orderBy: any = { createdAt: 'desc' };
    switch (sort) {
      case 'oldest': orderBy = { createdAt: 'asc' }; break;
      case 'title': orderBy = { title: 'asc' }; break;
      case 'viewers': orderBy = { viewersCount: 'desc' }; break;
    }
    
    const programs = await prisma.program.findMany({
      where,
      include: { genre: true },
      orderBy,
    });
    
    const excelBuffer = await generateProgramsExcel(programs);
    
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="banke-rasane-${Date.now()}.xlsx"`,
        'Content-Length': excelBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('[api/export/excel] Error:', error);
    return NextResponse.json(
      { error: 'Excel export failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
