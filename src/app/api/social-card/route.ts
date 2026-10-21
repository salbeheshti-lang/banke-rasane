import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureSeedData } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PLATFORMS = [
  { id: 'telegram', name: 'تلگرام', color: '#0088cc', maxSize: 4096 },
  { id: 'bale', name: 'بله', color: '#ffaa00', maxSize: 2048 },
  { id: 'ita', name: 'ایفا', color: '#3b82f6', maxSize: 2048 },
  { id: 'soroush', name: 'سروش', color: '#f97316', maxSize: 2048 },
  { id: 'gap', name: 'گپ', color: '#22c55e', maxSize: 2048 },
  { id: 'instagram', name: 'اینستاگرام', color: '#e1306c', maxSize: 2200 },
  { id: 'twitter', name: 'توییتر', color: '#1da1f2', maxSize: 280 },
  { id: 'whatsapp', name: 'واتساپ', color: '#25d366', maxSize: 4096 },
];

export async function GET() {
  return NextResponse.json({ platforms: PLATFORMS });
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeedData();
    
    const body = await request.json();
    const { programIds, platform } = body;
    
    if (!programIds || !Array.isArray(programIds) || programIds.length === 0) {
      return NextResponse.json({ error: 'No programs selected' }, { status: 400 });
    }
    
    const programs = await prisma.program.findMany({
      where: { id: { in: programIds } },
      include: { genre: true },
    });
    
    const platformInfo = PLATFORMS.find(p => p.id === platform) || PLATFORMS[0];
    
    // Generate post text
    let postText = '';
    
    if (programs.length === 1) {
      const p = programs[0];
      postText = `🎬 ${p.title}\n\n📝 ${p.description || ''}\n\n🎭 دسته‌بندی: ${p.genre?.nameFa}\n⏱ مدت: ${p.duration || '-'} دقیقه\n👤 تهیه‌کننده: ${p.producer || '-'}\n\n#بانک_رسانه #${p.genre?.nameFa.replace(/\s/g, '_')}`;
    } else {
      postText = `🎬 برنامه‌های منتخب بانک رسانه\n\n`;
      postText += `تعداد: ${programs.length} برنامه\n\n`;
      postText += programs.slice(0, 10).map((p, i) => `${i + 1}. ${p.title}`).join('\n');
      if (programs.length > 10) {
        postText += `\n... و ${programs.length - 10} برنامه دیگر`;
      }
      postText += `\n\n#بانک_رسانه #مجموعه_برنامه‌ها`;
    }
    
    // Truncate to platform limit
    if (postText.length > platformInfo.maxSize) {
      postText = postText.substring(0, platformInfo.maxSize - 3) + '...';
    }
    
    // Generate social card data (1080x1080)
    const cardData = {
      size: { width: 1080, height: 1080 },
      background: platformInfo.color,
      title: programs.length === 1 ? programs[0].title : `${programs.length} برنامه منتخب`,
      subtitle: 'بانک رسانه',
      genre: programs[0]?.genre?.nameFa,
      programs: programs.slice(0, 6).map(p => ({
        title: p.title,
        genre: p.genre?.nameFa,
        color: p.genre?.color,
      })),
      platform: platformInfo,
    };
    
    return NextResponse.json({
      postText,
      cardData,
      platform: platformInfo,
    });
  } catch (error) {
    console.error('[api/social-card] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate social card', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
