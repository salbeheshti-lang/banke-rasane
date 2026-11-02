// ============================================================================
// SEED DATA — 449 new programs across 11 new genre categories
// Categories with decor (8): kasht-darakht, krismas, polisi, ramazan,
//   safar-jadeh, naghd-film, ghanun-asasi, jasoosi
// Categories WITHOUT decor (3): sarfjooyi (PSA-like), madrese (PSA-like),
//   pakhsh-zende (live stream)
// Each show gets a unique `num` starting at 561.
// ============================================================================

export type NewShow = {
  num: number;
  name: string;
  category: string;          // Persian genre name — must match Genre.nameFa in page.tsx
  source: string;
  size: string;
  viewers: string;
  style: string;
  effects: string;
  layout: string;
  elements: string;
  materials: string;
  colors: string;
  lighting: string;
  summary: string;
  descriptionFa: string;
  tags?: string[];           // section-specific tags
  isFilm?: boolean;
};

// Category name constants (must match Genre.nameFa in page.tsx)
export const CAT = {
  sarfjooyi: 'صرفه‌جویی',
  kasht: 'کاشت درخت',
  krismas: 'کریسمس',
  polisi: 'پلیسی',
  ramazan: 'رمضان',
  safar: 'سفر جاده‌ای',
  madrese: 'مدرسه',
  naghd: 'نقد فیلم',
  ghanun: 'قانون اساسی',
  pakhsh: 'پخش زنده',
  jasoosi: 'جاسوسی',
  zandan: 'زندان',
  ehda: 'اهدای عضو',
  tarikhi: 'تاریخی',
  radio: 'رادیو تصویری',
  rusta: 'روستا',
} as const;

// ---------------------------------------------------------------------------
// Decor templates per category (for programs that DO have decor)
// ---------------------------------------------------------------------------
type Decor = Partial<Pick<NewShow,
  'size' | 'viewers' | 'style' | 'effects' | 'layout' | 'elements' |
  'materials' | 'colors' | 'lighting' | 'summary' | 'descriptionFa'>>;

// --- Empty decor (for sarfjooyi/madrese/pakhsh-zende which have NO decor) ---
const NO_DECOR: Decor = {
  size: '', viewers: '', style: '', effects: '', layout: '',
  elements: '', materials: '', colors: '', lighting: '',
};

// Helper: build a show record with sensible decor defaults
export function mk(
  num: number,
  name: string,
  category: string,
  decor: Decor,
  tags: string[] = [],
  isFilm = false,
): NewShow {
  return {
    num, name, category,
    source: 'متن',
    size: decor.size || '',
    viewers: decor.viewers || '',
    style: decor.style || '',
    effects: decor.effects || '',
    layout: decor.layout || '',
    elements: decor.elements || '',
    materials: decor.materials || '',
    colors: decor.colors || '',
    lighting: decor.lighting || '',
    summary: decor.summary || '',
    descriptionFa: decor.descriptionFa || decor.summary || '',
    tags,
    isFilm,
  };
}

// ============================================================================
// 1) SARFJOOYI (13 programs) — NO DECOR (PSA/ad-like)
// ============================================================================
const sarfjooyiShows: NewShow[] = [
  mk(561, 'Save Your Energy', CAT.sarfjooyi, { summary: 'برنامهٔ آگاهی‌بخش دربارهٔ صرفه‌جویی در مصرف انرژی خانگی؛ نکات کاربردی برای کاهش هزینه برق و گاز.' }, ['آگاهی‌بخش', 'انرژی', 'PSA']),
  mk(562, 'The Great Big Energy Saving Challenge', CAT.sarfjooyi, { summary: 'مسابقه خانواده‌ها برای کاهش مصرف انرژی با راهکارهای ساده و کاربردی.' }, ['مسابقه', 'انرژی']),
  mk(563, 'Power to the Pococks: A Year in the Life of a Crofting Family', CAT.sarfjooyi, { summary: 'مستندی دربارهٔ زندگی خانواده‌ای در اسکاتلند که با کشتزار خانگی و صرفه‌جویی انرژی زندگی می‌کنند.' }, ['مستند', 'سبک زندگی']),
  mk(564, 'Eco House Challenge', CAT.sarfjooyi, { summary: 'چالش سبز خانه‌ها؛ خانواده‌ها برای کاهش ردپای کربنی رقابت می‌کنند.' }, ['سبز', 'چالش']),
  mk(565, 'PowerHouse TV', CAT.sarfjooyi, { summary: 'برنامه‌ای دربارهٔ بهره‌وری انرژی در خانه و معرفی فناوری‌های کم‌مصرف.' }, ['انرژی', 'فناوری']),
  mk(566, 'Living with Ed', CAT.sarfjooyi, { summary: 'زندگی با اد بگلی، بازیگری که سبک زندگی کاملاً سبز و سازگار با محیط زیست دارد.' }, ['سبک زندگی', 'سبز']),
  mk(567, 'Wa$ted', CAT.sarfjooyi, { summary: 'برنامه‌ای که خانواده‌ها را در کاهش زباله و هزینه‌ها یاری می‌کند.' }, ['زباله', 'صرفه‌جویی']),
  mk(568, 'Green Builders', CAT.sarfjooyi, { summary: 'سازندگان سبز؛ ساخت خانه‌های دوستدار محیط زیست با متریال پایدار.' }, ['ساخت‌وساز', 'سبز']),
  mk(569, 'Race to Save Water', CAT.sarfjooyi, { summary: 'مسابقه‌ای برای صرفه‌جویی در مصرف آب خانگی و آگاهی‌بخشی دربارهٔ بحران آب.' }, ['آب', 'مسابقه']),
  mk(570, 'Energy Switch', CAT.sarfjooyi, { summary: 'برنامه‌ای دربارهٔ جابه‌جایی به منابع انرژی پاک و تجدیدپذیر.' }, ['انرژی', 'پاک']),
  mk(571, 'The Rain We Keep', CAT.sarfjooyi, { summary: 'مستندی دربارهٔ جمع‌آوری آب باران و روش‌های سنتی و مدرن ذخیره آب.' }, ['آب', 'مستند']),
  mk(572, 'The Water Brothers', CAT.sarfjooyi, { summary: 'دو برادر متخصص محیط زیست که بحران‌های آب جهان را بررسی می‌کنند.' }, ['آب', 'محیط زیست']),
  mk(573, 'Building Green', CAT.sarfjooyi, { summary: 'ساخت خانه‌های سبز با متریال بازیافتی و فناوری‌های کم‌مصرف.' }, ['ساخت‌وساز', 'سبز']),
];

// ============================================================================
// 2) KASHT-DARAKHT (21 programs) — HAS DECOR (gardening/lifestyle)
// ============================================================================
const kashtShows: NewShow[] = [
  mk(574, 'Greening Nevada / Green Up', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'باغچه، درختان، ابزار باغبانی، مبلمان فضای باز',
    materials: 'چوب، فلز، خاک، گیاهان', colors: 'سبز طبیعی، قهوه‌ای خاکی، زرد آفتابی',
    lighting: 'خورشید طبیعی', summary: 'برنامه‌ای برای سبز کردن نوادا و کاشت درخت با مشارکت جامعه محلی.',
  }, ['کاشت درخت', 'جامعه']),
  mk(575, 'The Secret Life of Trees', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'درختان، نمودارها، نمونه‌های گیاهی، نمایشگر',
    materials: 'چوب، شیشه، فلز', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'ترکیبی', summary: 'مستند علمی دربارهٔ زندگی پنهان درختان و ارتباط آن‌ها با اکوسیستم.',
  }, ['مستند', 'علمی']),
  mk(576, 'This Is Emily Yeung', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'باغچه، گلدان، ابزار کودکانه',
    materials: 'چوب، پلاستیک، پارچه', colors: 'رنگ‌های شاد و روشن',
    lighting: 'روشن', summary: 'برنامه کودکان که در آن امیلی یانگ با کاشت گل و درخت آشنا می‌شود.',
  }, ['کودک', 'آموزشی']),
  mk(577, 'Roots', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'ریشه درختان، خاک، نمونه‌های گیاهی',
    materials: 'چوب، خاک، شیشه', colors: 'قهوه‌ای خاکی، سبز',
    lighting: 'ترکیبی', summary: 'مستندی دربارهٔ ریشه‌های درختان و سیستم زیرزمینی گیاهان.',
  }, ['مستند']),
  mk(578, 'Roots of Life', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'باغچه، درختان کهنسال، نورپردازی دراماتیک',
    materials: 'چوب، فلز، پارچه', colors: 'سبز تیره، قهوه‌ای، طلایی',
    lighting: 'ترکیبی', summary: 'مستندی دربارهٔ ریشه‌های حیات و ارتباط گیاهان با زندگی انسان.',
  }, ['مستند', 'فلسفی']),
  mk(579, 'Growing a Greener World', CAT.kasht, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'باغچه‌های بزرگ، گلخانه، نمایشگر، میز کار',
    materials: 'چوب، شیشه، فلز', colors: 'سبز، سفید، کرم',
    lighting: 'روشن', summary: 'برنامه باغبانی برای ساختن دنیای سبزتر با راهکارهای پایدار.',
  }, ['باغبانی', 'سبز']),
  mk(580, 'Gardening by the Yard', CAT.kasht, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'حیاط بزرگ، باغچه، گلدان، ابزار باغبانی',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، زرد',
    lighting: 'خورشید طبیعی', summary: 'برنامه باغبانی حیاط با نکات عملی برای کاشت و نگهداری گیاهان.',
  }, ['باغبانی', 'حیاط']),
  mk(581, 'Green Fingers', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'باغچه، گلدان، میز کار باغبانی',
    materials: 'چوب، فلز، پارچه', colors: 'سبز، قهوه‌ای',
    lighting: 'روشن', summary: 'برنامه‌ای دربارهٔ باغبانان حرفه‌ای و ترفندهای کاشت گل.',
  }, ['باغبانی']),
  mk(582, "Gardeners' World", CAT.kasht, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'باغچه بزرگ، گلخانه، نمایش گل‌ها، ابزار',
    materials: 'چوب، شیشه، فلز، پارچه', colors: 'سبز، کرم، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'برنامه باغبانی بی‌بی‌سی با تمرکز بر باغداری فصلی و گیاهان زینتی.',
  }, ['باغبانی', 'فصلی']),
  mk(583, 'Garden Smart', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'باغچه، میز کار، نمایشگر',
    materials: 'چوب، فلز، شیشه', colors: 'سبز، خاکستری',
    lighting: 'روشن', summary: 'برنامه‌ای برای باغبانی هوشمندانه و کم‌هزینه.',
  }, ['باغبانی', 'هوشمند']),
  mk(584, 'The Modern Gardener', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'باغچه مدرن، گلدان طراحی، نور LED',
    materials: 'فلز، شیشه، چوب', colors: 'سبز، خاکستری، سفید',
    lighting: 'ترکیبی', summary: 'برنامه باغبانی مدرن با تمرکز بر طراحی و فناوری.',
  }, ['باغبانی', 'مدرن']),
  mk(585, 'Great British Garden Revival', CAT.kasht, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'کلاسیک/سنتی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'باغچه‌های انگلیسی، مجسمه، آبنما، گل‌های وحشی',
    materials: 'چوب، سنگ، فلز', colors: 'سبز، کرم، قرمز گل‌ها',
    lighting: 'خورشید طبیعی', summary: 'احیای باغچه‌های سنتی انگلیسی با تمرکز بر گیاهان بومی.',
  }, ['سنتی', 'انگلیسی']),
  mk(586, 'The Edible Garden', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'باغچه سبزیجات، گلدان، ابزار آشپزی',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قرمز، نارنجی',
    lighting: 'خورشید طبیعی', summary: 'کاشت سبزیجات و گیاهان خوراکی در باغچه خانگی.',
  }, ['خوراکی', 'باغبانی']),
  mk(587, 'Real Gardens', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'باغچه واقعی، گلدان، ابزار',
    materials: 'چوب، فلز، پارچه', colors: 'سبز، قهوه‌ای',
    lighting: 'خورشید طبیعی', summary: 'بررسی باغچه‌های واقعی خانگی و راهکارهای بهبود.',
  }, ['باغبانی', 'خانگی']),
  mk(588, 'Gardening with Carol Klein', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'باغچه شخصی، میز کار، نمونه‌های گیاهی',
    materials: 'چوب، فلز، پارچه', colors: 'سبز، کرم',
    lighting: 'روشن', summary: 'باغبانی با کارول کلین، متخصص گیاهان و گل‌های زینتی.',
  }, ['باغبانی', 'تخصصی']),
  mk(589, 'The Family Plot: Gardening', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'باغچه خانوادگی، گلدان، ابزار کودکانه',
    materials: 'چوب، فلز، پلاستیک', colors: 'سبز، زرد، قرمز',
    lighting: 'خورشید طبیعی', summary: 'باغبانی خانوادگی برای والدین و کودکان.',
  }, ['خانوادگی', 'باغبانی']),
  mk(590, 'Virginia Home Grown', CAT.kasht, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'باغچه ویرجینیا، گلدان، ابزار باغبانی',
    materials: 'چوب، فلز', colors: 'سبز، قهوه‌ای',
    lighting: 'خورشید طبیعی', summary: 'برنامه باغبانی محلی ویرجینیا با گیاهان بومی منطقه.',
  }, ['محلی', 'باغبانی']),
  mk(591, 'Gardening Australia', CAT.kasht, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'باغچه استرالیایی، گلخانه، نمایش گل‌ها',
    materials: 'چوب، شیشه، فلز', colors: 'سبز، قرمز، نارنجی',
    lighting: 'خورشید طبیعی', summary: 'برنامه باغبانی استرالیا با تمرکز بر گیاهان گرمسیری.',
  }, ['استرالیا', 'باغبانی']),
  mk(592, 'The Great Garden Revolution', CAT.kasht, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'باغچه مدرن، نورپردازی LED، نمایشگر',
    materials: 'فلز، شیشه، چوب', colors: 'سبز، خاکستری، سفید',
    lighting: 'ترکیبی', summary: 'انقلاب باغچه‌های مدرن با طراحی خلاقانه و فناوری.',
  }, ['انقلاب', 'مدرن']),
  mk(593, 'Recreating Eden', CAT.kasht, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'باغچه بهشتی، آبنما، مجسمه، گل‌های استوایی',
    materials: 'سنگ، فلز، شیشه', colors: 'سبز، آبی، طلایی',
    lighting: 'ترکیبی', summary: 'بازخلقی بهشت زمینی با باغچه‌های فاخر و طراحی حرفه‌ای.',
  }, ['فاخر', 'بهشتی']),
];

// ============================================================================
// 3) KRISMAS (15 programs) — HAS DECOR (Christmas specials)
// ============================================================================
const krismasShows: NewShow[] = [
  mk(594, 'Carols by Candlelight', CAT.krismas, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'درخت کریسمس بزرگ، شمع، نورپردازی رنگی، گروه کر',
    materials: 'چوب، شیشه، فلز، پارچه', colors: 'قرمز، سبز، طلایی، سفید',
    lighting: 'گرم', summary: 'برنامه سنتی استرالیایی برای شب کریسمس با گروه کر و موسیقی زنده.',
  }, ['موسیقی', 'کر']),
  mk(595, 'Christmas in Hospitals', CAT.krismas, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بخش بیمارستان، درخت کوچک کریسمس، تزئینات',
    materials: 'فلز، پلاستیک، پارچه', colors: 'سفید، قرمز، سبز',
    lighting: 'روشن', summary: 'ویژه‌برنامه کریسمس در بیمارستان‌ها برای بیماران و کادر درمان.',
  }, ['بیمارستان', 'خیریه']),
  mk(596, 'Disney Parks Christmas Day Parade', CAT.krismas, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'رژه بزرگ، شخصیت‌های دیزنی، درخت غول‌پیکر، نورپردازی',
    materials: 'فلز، پارچه، شیشه', colors: 'قرمز، سبز، طلایی، آبی',
    lighting: 'ترکیبی', summary: 'رژه روز کریسمس در پارک دیزنی با حضور شخصیت‌ها و موسیقی.',
  }, ['رژه', 'دیزنی']),
  mk(597, 'Sinterklaas News', CAT.krismas, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'دکور کشتی سینترکلاس، کلاه قرمز، کیسه هدیه',
    materials: 'چوب، پارچه، فلز', colors: 'قرمز، سفید، طلایی',
    lighting: 'گرم', summary: 'برنامه خبری هلندی دربارهٔ سفر سینترکلاس و یارانش.',
  }, ['هلند', 'سنتی']),
  mk(598, 'Late Night Toy Show', CAT.krismas, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'میز اسباب‌بازی بزرگ، درخت کریسمس، نور آفتابی',
    materials: 'چوب، فلز، شیشه', colors: 'قرمز، سبز، طلایی',
    lighting: 'گرم', summary: 'برنامه آخر شب معرفی اسباب‌بازی‌های جدید برای کریسمس.',
  }, ['اسباب‌بازی', 'آخر شب']),
  mk(599, 'Spanish Christmas Lottery', CAT.krismas, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه بزرگ قرعه‌کشی، گوی شیشه‌ای، نمایشگر نتایج',
    materials: 'فلز، شیشه، چوب', colors: 'قرمز، طلایی، سفید',
    lighting: 'روشن', summary: 'قرعه‌کشی لاتاری کریسمس اسپانیا، رویداد ملی سالانه.',
  }, ['لاتاری', 'اسپانیا']),
  mk(600, 'Donald Duck and Friends Wish You a Merry Christmas', CAT.krismas, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'دکور کارتونی، درخت کریسمس، شخصیت‌های دیزنی',
    materials: 'پارچه، فلز، پلاستیک', colors: 'آبی، قرمز، زرد',
    lighting: 'روشن', summary: 'ویژه‌برنامه کارتونی کریسمس با اردک دونالد و دوستانش.',
  }, ['کارتون', 'کودک']),
  mk(601, 'Novena de Aguinaldos', CAT.krismas, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'کلاسیک/سنتی', effects: 'فیزیکی/واقعی',
    layout: 'سنۀ اجرا', elements: 'محیط کلیسا، شمع، تزئینات مذهبی',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، سبز، طلایی',
    lighting: 'گرم', summary: 'مراسم نُه روزه کلمبیایی پیش از کریسمس با دعاهای سنتی.',
  }, ['مذهبی', 'سنتی']),
  mk(602, 'After the Rain: A Christmas of Hope', CAT.krismas, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'دکور روستایی، درخت کریسمس ساده، شمع',
    materials: 'چوب، پارچه، فلز', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'گرم', summary: 'فیلم کریسمسی دربارهٔ امید و بازیابی زندگی پس از سختی.',
  }, ['امید', 'درام']),
  mk(603, "Dick Clark's New Year's Rockin' Eve", CAT.krismas, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'نمایشگر/LEDمحور',
    layout: 'سنۀ اجرا', elements: 'صحنه بزرگ موسیقی، نمایشگر LED، آتش‌بازی، تماشاگران',
    materials: 'فلز، شیشه، LED', colors: 'طلایی، نقره‌ای، قرمز، آبی',
    lighting: 'ترکیبی', summary: 'برنامه شب سال نو آمریکا با اجرای زنده موسیقی و آتش‌بازی.',
  }, ['سال نو', 'موسیقی']),
  mk(604, 'Roberto Carlos Special', CAT.krismas, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه بزرگ، گروه موسیقی، نورپردازی تئاتری',
    materials: 'فلز، شیشه، پارچه', colors: 'طلایی، سفید، آبی',
    lighting: 'ترکیبی', summary: 'ویژه‌برنامه سالانه خواننده برزیلی روبرتو کارلوس.',
  }, ['موسیقی', 'برزیل']),
  mk(605, "The National Lottery's New Year's Eve Big Bash", CAT.krismas, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه بزرگ، نمایشگر، تماشاگران، نورپردازی',
    materials: 'فلز، شیشه، پارچه', colors: 'طلایی، بنفش، آبی',
    lighting: 'ترکیبی', summary: 'برنامه بزرگ شب سال نیوی لاتاری ملی بریتانیا با موسیقی.',
  }, ['سال نو', 'لاتاری']),
  mk(606, "Ant & Dec's Christmas Show", CAT.krismas, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه تئاتری، درخت کریسمس بزرگ، نورپردازی',
    materials: 'فلز، شیشه، پارچه', colors: 'قرمز، سبز، طلایی',
    lighting: 'ترکیبی', summary: 'ویژه‌برنامه کریسمسی آنت و دک با موسیقی و مهمانان ویژه.',
  }, ['سرگرمی', 'ویژه']),
  mk(607, "New Year's Eve and Christmas Eve Big Show", CAT.krismas, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه بزرگ، گروه موسیقی، آتش‌بازی، تماشاگران',
    materials: 'فلز، شیشه، LED', colors: 'طلایی، قرمز، نقره‌ای',
    lighting: 'ترکیبی', summary: 'برنامه بزرگ شب کریسمس و شب سال نو با اجرای موسیقی زنده.',
  }, ['سال نو', 'موسیقی']),
  mk(608, 'Die Silvester Show', CAT.krismas, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه بزرگ آلمانی، گروه موسیقی، آتش‌بازی',
    materials: 'فلز، شیشه، پارچه', colors: 'طلایی، قرمز، مشکی',
    lighting: 'ترکیبی', summary: 'برنامه آلمانی شب سال نو (Silvester) با موسیقی و سرگرمی.',
  }, ['سال نو', 'آلمان']),
];

export const allNewShows: NewShow[] = [
  ...sarfjooyiShows,
  ...kashtShows,
  ...krismasShows,
];
