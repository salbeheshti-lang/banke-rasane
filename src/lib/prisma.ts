import { PrismaClient } from '@prisma/client';

// Prisma client singleton - prevents multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Initialize database with seed data if empty
export async function ensureSeedData() {
  try {
    const genreCount = await prisma.genre.count();
    if (genreCount === 0) {
      await seedDatabase();
    }
  } catch (e) {
    console.error('[seed] Error:', e);
  }
}

const GENRES = [
  { key: 'decor', nameFa: 'دکور برنامه‌ها', name: 'Decor Shows', color: '#22c55e', order: 1, description: 'برنامه‌های دکور و تنوع' },
  { key: 'reality', nameFa: 'ریلیتی شو', name: 'Reality Shows', color: '#ef4444', order: 2, description: 'برنامه‌های واقع‌نما' },
  { key: 'documentary', nameFa: 'مستندها', name: 'Documentaries', color: '#3b82f6', order: 3, description: 'مستندهای تلویزیونی' },
  { key: 'news', nameFa: 'برنامه‌های خبری', name: 'News Programs', color: '#f59e0b', order: 4, description: 'برنامه‌های خبری و تحلیلی' },
  { key: 'interview', nameFa: 'مصاحبه‌ها', name: 'Interviews', color: '#8b5cf6', order: 5, description: 'مصاحبه‌ها و گفتگوها' },
  { key: 'kids', nameFa: 'برنامه‌های کودک', name: 'Kids Programs', color: '#ec4899', order: 6, description: 'برنامه‌های کودک و نوجوان' },
  { key: 'sports', nameFa: 'ورزشی', name: 'Sports', color: '#14b8a6', order: 7, description: 'برنامه‌های ورزشی' },
  { key: 'music', nameFa: 'موسیقی و کنسرت', name: 'Music & Concerts', color: '#f97316', order: 8, description: 'برنامه‌های موسیقی' },
  { key: 'education', nameFa: 'آموزشی', name: 'Educational', color: '#6366f1', order: 9, description: 'برنامه‌های آموزشی' },
];

async function seedDatabase() {
  console.log('[seed] Seeding initial data...');
  
  // Create genres
  for (const g of GENRES) {
    await prisma.genre.create({ data: g });
  }
  
  // Generate sample programs for each genre
  const sampleTitles = [
    'برنامه نمونه', 'ویژه برنامه', 'مجموعه برنامه‌ها', 'برنامه هفتگی',
    'ویژه ماهانه', 'برنامه فصلی', 'مجموعه نمایشی', 'برنامه زنده',
    'مجموعه فرهنگی', 'برنامه علمی', 'مجموعه هنری', 'برنامه اجتماعی',
  ];
  
  const producers = ['مرکز صدا و سیما', 'شبکه یک', 'شبکه دو', 'شبکه سه', 'شبکه آموزش', 'شبکه مستند', 'شبکه شما'];
  const directors = ['کارگردان ۱', 'کارگردان ۲', 'کارگردان ۳', 'کارگردان ۴', 'کارگردان ۵'];
  const presenters = ['مجری ۱', 'مجری ۲', 'مجری ۳', 'مجری ۴'];
  
  const targetCounts: Record<string, number> = {
    decor: 560,
    reality: 6,
    documentary: 6,
    news: 4,
    interview: 0,
    kids: 3,
    sports: 2,
    music: 3,
    education: 3,
  };
  
  for (const genre of GENRES) {
    const count = targetCounts[genre.key] || 0;
    for (let i = 1; i <= count; i++) {
      const titleIdx = i % sampleTitles.length;
      await prisma.program.create({
        data: {
          title: `${sampleTitles[titleIdx]} ${i} - ${genre.nameFa}`,
          titleEn: `${genre.name} Program ${i}`,
          genreId: (await prisma.genre.findFirst({ where: { key: genre.key } }))!.id,
          description: `برنامه نمونه شماره ${i} در دسته‌بندی ${genre.nameFa}. این برنامه به‌عنوان نمونه در بانک رسانه ثبت شده است.`,
          duration: 30 + (i % 60),
          episodeCount: 1 + (i % 12),
          viewersCount: i % 4 === 0 ? Math.floor(Math.random() * 10000) : 0,
          hasImages: i % 3 === 0,
          hasVideo: i % 5 === 0,
          status: 'published',
          producer: producers[i % producers.length],
          director: directors[i % directors.length],
          presenter: presenters[i % presenters.length],
          channel: `شبکه ${(i % 7) + 1}`,
          airDate: new Date(2024, 0, 1 + (i % 365)),
          tags: JSON.stringify([genre.key, 'sample']),
        },
      });
    }
  }
  
  console.log('[seed] Done. Total programs:', await prisma.program.count());
}
