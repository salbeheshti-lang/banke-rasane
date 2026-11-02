// ============================================================================
// SEED DATA PART 4 — Zandan, Ehda, Tarikhi, Radio, Rusta (5 new categories)
// ============================================================================
import { CAT, NewShow, mk } from './seed-data-part1';

// ============================================================================
// 12) ZANDAN (Prison) — 17 programs — HAS DECOR (prison documentary)
// ============================================================================
const zandanShows: NewShow[] = [
  // مستند
  mk(1010, 'To Prison', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'زندان، سلول، راهرو، دوربین مداربسته',
    materials: 'فلز، بتن، شیشه', colors: 'خاکستری، مشکی، نارنجی',
    lighting: 'سرد', summary: 'مستند ورود به زندان و زندگی زندانیان.',
  }, ['مستند', 'زندان']),
  mk(1011, 'Solitary', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'سلول انفرادی، درب فلزی، نور کم',
    materials: 'فلز، بتن', colors: 'خاکستری تیره، مشکی',
    lighting: 'تاریک', summary: 'مستند زندگی در سلول انفرادی.',
  }, ['مستند', 'انفرادی']),
  mk(1012, 'The Work', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'کارگاه زندان، میز کار، ابزار',
    materials: 'فلز، چوب', colors: 'خاکستری، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'مستند کار اجباری زندانیان.',
  }, ['مستند', 'کار']),
  mk(1013, 'The Fear of 13', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز مصاحبه، سلول، آرشیو',
    materials: 'چوب، فلز، شیشه', colors: 'خاکستری، کرم، قرمز تیره',
    lighting: 'ترکیبی', summary: 'مستند محکوم به اعدام پس از ۳۰ سال منتظر اعدام.',
  }, ['مستند', 'اعدام']),
  mk(1014, 'The Prison Within', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'زندان، میز مصاحبه، آرشیو',
    materials: 'چوب، فلز، شیشه', colors: 'خاکستری، مشکی، کرم',
    lighting: 'ترکیبی', summary: 'مستند درون زندان و روانشناسی زندانیان.',
  }, ['مستند', 'روانشناسی']),
  mk(1015, 'Dream/Killer', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'دادگاه، زندان، آرشیو',
    materials: 'چوب، فلز، شیشه', colors: 'خاکستری، قرمز تیره، کرم',
    lighting: 'ترکیبی', summary: 'مستند پدر در پی اثبات بی‌گناهی پسرش.',
  }, ['مستند', 'بی‌گناهی']),
  mk(1016, 'Prison Terminal: The Last Days of Private Jack Hall', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان زندان، تخت، تجهیزات پزشکی',
    materials: 'فلز، پلاستیک، پارچه', colors: 'سفید، آبی، خاکستری',
    lighting: 'سرد', summary: 'مستند روزهای آخر یک زندانی پیر در بیمارستان زندان.',
  }, ['مستند', 'بیمارستان']),
  mk(1017, 'Rock and a Hard Place', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'اردوگاه اصلاح، جوانان، تمرین نظامی',
    materials: 'فلز، چوب، پارچه', colors: 'سبز زیتونی، خاکی، مشکی',
    lighting: 'ترکیبی', summary: 'مستند برنامه اردوگاه اصلاحی جوانان بزهکار.',
  }, ['مستند', 'اصلاح']),
  mk(1018, 'Louis Theroux: Behind Bars', CAT.zandan, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'زندان، سلول، راهرو، زندانیان',
    materials: 'فلز، بتن، شیشه', colors: 'خاکستری، مشکی، نارنجی',
    lighting: 'سرد', summary: 'مستند لوئیس ثرو در زندان سن کوئنتین.',
  }, ['مستند', 'سن کوئنتین']),
  mk(1019, '1275 Days', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'زندان، سلول، آرشیو',
    materials: 'فلز، بتن', colors: 'خاکستری، مشکی',
    lighting: 'سرد', summary: 'مستند ۱۲۷۵ روز حبس انفرادی.',
  }, ['مستند', 'حبس']),
  mk(1020, 'Prison for Profit', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'زندان خصوصی، مصاحبه، آرشیو',
    materials: 'چوب، فلز، شیشه', colors: 'خاکستری، طلایی، مشکی',
    lighting: 'ترکیبی', summary: 'مستند زندان‌های خصوصی و سودآوری از زندانیان.',
  }, ['مستند', 'خصوصی']),
  mk(1021, 'Inside Death Row with Trevor McDonald', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'سالن اعدام، سلول، مصاحبه',
    materials: 'فلز، بتن، شیشه', colors: 'خاکستری، قرمز تیره، مشکی',
    lighting: 'سرد', summary: 'مستند داخل راهروی مرگ با ترور مک‌دونالد.',
  }, ['مستند', 'اعدام']),
  mk(1022, 'Prison Valley', CAT.zandan, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'منطقه زندان‌ها، شهر، زندانیان',
    materials: 'بتن، فلز، شیشه', colors: 'خاکستری، نارنجی، سبز',
    lighting: 'ترکیبی', summary: 'مستند دره‌ای با ۱۳ زندان در کلرادو.',
  }, ['مستند', 'کلرادو']),
  mk(1023, 'The Mark of Cain', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'زندان، تاتو، باندها',
    materials: 'فلز، بتن، پارچه', colors: 'خاکستری، مشکی، قرمز',
    lighting: 'سرد', summary: 'مستند تاتو و باندهای زندانی بریتانیا.',
  }, ['مستند', 'تاتو']),
  mk(1024, 'Prison Life: Justice in Japan', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'زندان ژاپن، سلول، نظم',
    materials: 'فلز، چوب، شیشه', colors: 'سفید، خاکستری، کرم',
    lighting: 'روشن', summary: 'مستند زندگی زندان در ژاپن.',
  }, ['مستند', 'ژاپن']),
  // مجموعه مستند و زندگی‌واقعی
  mk(1025, 'Biography', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'کلاسیک/سنتی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز اجرا، آرشیو، عکس',
    materials: 'چوب، فلز، پارچه', colors: 'قهوه‌ای، طلایی، کرم',
    lighting: 'گرم', summary: 'مجموعه مستند زندگی‌نامه افراد مشهور.',
  }, ['بیوگرافی', 'زندگی‌نامه']),
  // مسابقه تلویزیونی / رئالیتی‌شو
  mk(1026, 'Solitary (TV Series)', CAT.zandan, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'نمایشگر/LEDمحور',
    layout: 'موقعیت‌محور', elements: 'اتاق انفرادی، دوربین، نمایشگر',
    materials: 'فلز، شیشه، LED', colors: 'مشکی، آبی، نئون',
    lighting: 'ترکیبی', summary: 'رئالیتی‌شوی مسابقه در انفرادی.',
  }, ['رئالیتی', 'انفرادی']),
  mk(1027, 'Game Show', CAT.zandan, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه مسابقه، نمایشگر، تماشاگران',
    materials: 'فلز، شیشه، پارچه', colors: 'طلایی، قرمز، آبی',
    lighting: 'ترکیبی', summary: 'مسابقه تلویزیونی زندانی.',
  }, ['مسابقه', 'زندان']),
];

// ============================================================================
// 13) EHDA (Organ Donation) — 60 programs — HAS DECOR (medical dramas)
// ============================================================================
const ehdaShows: NewShow[] = [
  // سریال تلویزیونی (28)
  mk(1028, 'Three Rivers', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، اتاق عمل، تجهیزات پیوند',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، فولادی',
    lighting: 'سرد', summary: 'سریال پزشکی دربارهٔ تیم پیوند اعضای بیمارستان.',
  }, ['سریال', 'پیوند'], true),
  mk(1029, 'ER (Emergency Room)', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'اورژانس، تخت بیمار، تجهیزات',
    materials: 'فلز، پلاستیک، شیشه', colors: 'سفید، آبی، سبز',
    lighting: 'روشن', summary: 'سریال پزشکی اورژانس بیمارستان.',
  }, ['سریال', 'اورژانس'], true),
  mk(1030, "Grey's Anatomy", CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، اتاق عمل، تجهیزات',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، خاکستری',
    lighting: 'سرد', summary: 'سریال پزشکی زندگی جراحان.',
  }, ['سریال', 'جراحی'], true),
  mk(1031, 'The Good Doctor', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، اتاق عمل، تیم پزشکی',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، فولادی',
    lighting: 'سرد', summary: 'سریال جراح جوان اوتیسم.',
  }, ['سریال', 'جراح'], true),
  mk(1032, 'St. Elsewhere', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'کلاسیک/سنتی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان قدیمی، تخت، تجهیزات سنتی',
    materials: 'چوب، فلز، شیشه', colors: 'سفید، سبز، کرم',
    lighting: 'گرم', summary: 'سریال پزشکی کلاسیک بیمارستان سن‌الجویس.',
  }, ['سریال', 'کلاسیک'], true),
  mk(1033, 'Combat Hospital', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان نظامی، چادر، تجهیزات',
    materials: 'فلز، پارچه، پلاستیک', colors: 'سبز زیتونی، خاکی، سفید',
    lighting: 'ترکیبی', summary: 'سریال بیمارستان نظامی در افغانستان.',
  }, ['سریال', 'نظامی'], true),
  mk(1034, 'Monday Mornings', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، جلسه، اتاق پزشکان',
    materials: 'فلز، شیشه، چوب', colors: 'سفید، آبی، خاکستری',
    lighting: 'سرد', summary: 'سریال پزشکی جلسات دوشنبه‌ها.',
  }, ['سریال', 'پزشکی'], true),
  mk(1035, 'The Mob Doctor', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، مافیا، کوچه',
    materials: 'فلز، چوب، شیشه', colors: 'خاکستری، قرمز، مشکی',
    lighting: 'ترکیبی', summary: 'سریال پزشک کار برای مافیا.',
  }, ['سریال', 'مافیا'], true),
  mk(1036, 'The Night Shift', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'اورژانس شب، تخت، تیم',
    materials: 'فلز، شیشه، پلاستیک', colors: 'آبی تیره، سفید، نارنجی',
    lighting: 'ترکیبی', summary: 'سریال شیفت شب اورژانس.',
  }, ['سریال', 'شب'], true),
  mk(1037, 'Transplant', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، اتاق عمل، پیوند',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، فولادی',
    lighting: 'سرد', summary: 'سریال پزشک پناهنده سوری در کانادا.',
  }, ['سریال', 'پناهنده'], true),
  mk(1038, 'Now and Again', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'آزمایشگاه، بیمارستان، دولت',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، خاکستری',
    lighting: 'سرد', summary: 'سریال مرد با بدن مصنوعی.',
  }, ['سریال', 'علمی'], true),
  mk(1039, 'Chambers', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، خانه، راز',
    materials: 'چوب، فلز، شیشه', colors: 'تیره، قرمز، مشکی',
    lighting: 'ترکیبی', summary: 'سریال دختری با قلب اهدا شده و رازها.',
  }, ['سریال', 'ترسناک'], true),
  mk(1040, 'The Marked Heart', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، قاچاق اعضا، تعقیب',
    materials: 'فلز، شیشه، چوب', colors: 'تیره، قرمز، خاکستری',
    lighting: 'ترکیبی', summary: 'سریال قاچاق اعضا و انتقام.',
  }, ['سریال', 'قاچاق'], true),
  mk(1041, 'Breathe', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، تنفس مصنوعی',
    materials: 'فلز، پلاستیک، شیشه', colors: 'سفید، آبی، نقره‌ای',
    lighting: 'سرد', summary: 'سریال پزشکی تنفس مصنوعی.',
  }, ['سریال', 'تنفس'], true),
  mk(1042, 'Strong Medicine', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، زنان، پزشکان',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، صورتی، آبی',
    lighting: 'روشن', summary: 'سریال پزشکی زنان.',
  }, ['سریال', 'زنان'], true),
  mk(1043, 'Scrubs', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، پزشکان جوان، کمدی',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، سبز',
    lighting: 'روشن', summary: 'سریال کمدی زندگی پزشکان جوان.',
  }, ['سریال', 'کمدی'], true),
  mk(1044, 'Code Black', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'اورژانس، تخت، تجهیزات',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، قرمز، خاکستری',
    lighting: 'سرد', summary: 'سریال اورژانس شلوغ بیمارستان.',
  }, ['سریال', 'اورژانس'], true),
  mk(1045, 'Holby City', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، اتاق عمل، پزشکان',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، سبز',
    lighting: 'روشن', summary: 'سریال پزشکی بیمارستان هولبی.',
  }, ['سریال', 'بریتانیا'], true),
  mk(1046, 'Casualty', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'اورژانس، تخت، تیم پزشکی',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، قرمز',
    lighting: 'روشن', summary: 'سریال اورژانس بیمارستان.',
  }, ['سریال', 'اورژانس'], true),
  mk(1047, 'Saving Hope', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، کما، روان',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، طلایی',
    lighting: 'ترکیبی', summary: 'سریال پزشک در کما و روان بیمارستان.',
  }, ['سریال', 'کما'], true),
  mk(1048, 'Nurse Jackie', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، پرستار، دارو',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، صورتی، آبی',
    lighting: 'روشن', summary: 'سریال پرستار با مشکلات شخصی.',
  }, ['سریال', 'پرستار'], true),
  mk(1049, 'MASH', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'کلاسیک/سنتی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان نظامی، چادر، کمدی',
    materials: 'فلز، پارچه، چوب', colors: 'سبز زیتونی، خاکی، کرم',
    lighting: 'ترکیبی', summary: 'سریال کمدی بیمارستان نظامی در جنگ کره.',
  }, ['سریال', 'نظامی'], true),
  mk(1050, 'Chicago Hope', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، جراحان، دادگاه',
    materials: 'فلز، شیشه، چوب', colors: 'سفید، آبی، قهوه‌ای',
    lighting: 'روشن', summary: 'سریال پزشکی بیمارستان Chicago Hope.',
  }, ['سریال', 'Chicago'], true),
  mk(1051, 'Law & Order: Special Victims Unit', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'دادگاه، ایستگاه پلیس، بیمارستان',
    materials: 'فلز، چوب، شیشه', colors: 'خاکستری، مشکی، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'سریال پلیس قربانیان ویژه.',
  }, ['سریال', 'پلیسی'], true),
  mk(1052, 'Hospital Playlist', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، دوستان، موسیقی',
    materials: 'فلز، شیشه، چوب', colors: 'سفید، آبی، گرم',
    lighting: 'روشن', summary: 'سریال کره‌ای زندگی پزشکان دوست.',
  }, ['سریال', 'کره'], true),
  mk(1053, 'The Resident', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، پزشک جوان، فساد',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، خاکستری',
    lighting: 'سرد', summary: 'سریال پزشک جوان و فساد بیمارستان.',
  }, ['سریال', 'فساد'], true),
  mk(1054, 'Chicago Med', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، اورژانس، تیم',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، قرمز',
    lighting: 'سرد', summary: 'سریال پزشکی Chicago Med.',
  }, ['سریال', 'Chicago'], true),
  mk(1055, 'Private Practice', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'کلینیک خصوصی، پزشکان، بیماران',
    materials: 'چوب، فلز، شیشه', colors: 'گرم، کرم، سفید',
    lighting: 'روشن', summary: 'سریال کلینیک خصوصی پزشکان.',
  }, ['سریال', 'کلینیک'], true),
  // مستند (15)
  mk(1056, 'Facing Death', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، ICU، بیماران',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، خاکستری، آبی',
    lighting: 'سرد', summary: 'مستند بیماران در آستانه مرگ.',
  }, ['مستند', 'مرگ']),
  mk(1057, 'Transplant Stories', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، بیماران، داستان',
    materials: 'فلز، شیشه، چوب', colors: 'سفید، آبی، کرم',
    lighting: 'ترکیبی', summary: 'مستند داستان‌های پیوند اعضا.',
  }, ['مستند', 'پیوند']),
  mk(1058, 'The Gift of Life', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، اهداکننده، گیرنده',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، سبز، آبی',
    lighting: 'روشن', summary: 'مستند هدیه زندگی با اهدای عضو.',
  }, ['مستند', 'اهدا']),
  mk(1059, 'Last Chance Transplant', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، اتاق عمل، زمان',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، قرمز',
    lighting: 'ترکیبی', summary: 'مستند آخرین شانس پیوند.',
  }, ['مستند', 'پیوند']),
  mk(1060, 'Vital Bonds', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، خانواده‌ها، داستان',
    materials: 'چوب، فلز، شیشه', colors: 'گرم، کرم، آبی',
    lighting: 'ترکیبی', summary: 'مستند پیوندهای حیاتی بین اهداکننده و گیرنده.',
  }, ['مستند', 'پیوند']),
  mk(1061, 'Transplant Tales', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، بیماران، داستان',
    materials: 'چوب، فلز، شیشه', colors: 'گرم، کرم، آبی',
    lighting: 'ترکیبی', summary: 'مستند قصه‌های پیوند.',
  }, ['مستند', 'داستان']),
  mk(1062, 'Organ Donation & Transplant', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، پزشکان، بیماران',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، سبز',
    lighting: 'روشن', summary: 'مستند اهدای عضو و پیوند.',
  }, ['مستند', 'آموزشی']),
  mk(1063, 'LifeGiving Transplant Stories', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، داستان، خانواده',
    materials: 'چوب، فلز، شیشه', colors: 'گرم، کرم، سبز',
    lighting: 'ترکیبی', summary: 'مستند داستان‌های پیوند بخشنده.',
  }, ['مستند', 'بخشنده']),
  mk(1064, 'Organ Donation Importance', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، پزشکان، آمار',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، سبز',
    lighting: 'روشن', summary: 'مستند اهمیت اهدای عضو.',
  }, ['مستند', 'آگاهی']),
  mk(1065, 'Donor Remembrance Day', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه یادبود، شمع، خانواده‌ها',
    materials: 'چوب، پارچه، فلز', colors: 'گرم، طلایی، کرم',
    lighting: 'گرم', summary: 'مستند روز یادبود اهداکنندگان.',
  }, ['مستند', 'یادبود']),
  mk(1066, 'Organ Donation Awareness', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، پزشکان، جامعه',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، آبی، سبز',
    lighting: 'روشن', summary: 'مستند آگاهی‌بخشی اهدای عضو.',
  }, ['مستند', 'آگاهی']),
  mk(1067, 'Organ Donation in Wyoming', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان وایومینگ، جامعه محلی',
    materials: 'چوب، فلز، شیشه', colors: 'گرم، کرم، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند اهدای عضو در وایومینگ.',
  }, ['مستند', 'وایومینگ']),
  mk(1068, 'The Moves to Transform the Organ Donation System in the UK', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، دولت، آمار',
    materials: 'فلز، شیشه، چوب', colors: 'سفید، آبی، قرمز',
    lighting: 'روشن', summary: 'مستند تحول سیستم اهدای عضو در بریتانیا.',
  }, ['مستند', 'بریتانیا']),
  mk(1069, "How Keira's Heart Saved Max", CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، خانواده، داستان',
    materials: 'چوب، فلز، شیشه', colors: 'گرم، قرمز، کرم',
    lighting: 'ترکیبی', summary: 'مستند قلب کیرا که مکس را نجات داد.',
  }, ['مستند', 'قلب']),
  mk(1070, 'Organ Donation Tourism in Spain', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان اسپانیا، توریسم، مصاحبه',
    materials: 'سنگ، چوب، فلز', colors: 'گرم، طلایی، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند توریسم اهدای عضو در اسپانیا.',
  }, ['مستند', 'اسپانیا']),
  mk(1071, 'Donor Unknown', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'بیمارستان، داستان، راز',
    materials: 'چوب، فلز، شیشه', colors: 'گرم، کرم، خاکستری',
    lighting: 'ترکیبی', summary: 'مستند اهداکننده ناشناس.',
  }, ['مستند', 'ناشناس']),
  // برنامه تلویزیونی / تاک‌شو (2)
  mk(1072, 'The Great Donor Show', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه بزرگ، تماشاگران، موسیقی',
    materials: 'فلز، شیشه، پارچه', colors: 'طلایی، قرمز، سفید',
    lighting: 'ترکیبی', summary: 'تاک‌شوی اهدای عضو با موسیقی و مهمانان.',
  }, ['تاک‌شو', 'اهدا']),
  mk(1073, 'Last Week Tonight with John Oliver', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'میز اجرا، نمایشگر، تماشاگران',
    materials: 'فلز، شیشه، پارچه', colors: 'آبی، قرمز، مشکی',
    lighting: 'ترکیبی', summary: 'تاک‌شوی آخر شب جان اولیور.',
  }, ['تاک‌شو', 'آخر شب']),
  // فیلم سینمایی (18)
  mk(1074, "Nicholas' Gift", CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، خانواده، ایتالیا',
    materials: 'سنگ، چوب، فلز', colors: 'گرم، طلایی، کرم',
    lighting: 'خورشید طبیعی', summary: 'فیلم هدیه نیکلاس، پسر اهدایی.',
  }, ['فیلم', 'اهدا'], true),
  mk(1075, '2 Hearts', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، عشق، قلب',
    materials: 'چوب، فلز، شیشه', colors: 'گرم، قرمز، کرم',
    lighting: 'ترکیبی', summary: 'فیلم دو قلب با پیوند.',
  }, ['فیلم', 'عشق'], true),
  mk(1076, 'Phir Zindagi', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، زندگی دوباره، هند',
    materials: 'چوب، فلز، پارچه', colors: 'گرم، قرمز، طلایی',
    lighting: 'ترکیبی', summary: 'فیلم هندی زندگی دوباره پس از پیوند.',
  }, ['فیلم', 'هند'], true),
  mk(1077, 'Dil Ne Jise Apna Kahaa', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، عشق، هند',
    materials: 'چوب، فلز، پارچه', colors: 'گرم، قرمز، طلایی',
    lighting: 'ترکیبی', summary: 'فیلم هندی عشق و قلب.',
  }, ['فیلم', 'هند'], true),
  mk(1078, 'John Q', CAT.ehda, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، گروگان‌گیری، دادگاه',
    materials: 'فلز، شیشه، چوب', colors: 'سرد، آبی، خاکستری',
    lighting: 'ترکیبی', summary: 'فیلم پدری که بیمارستان را گروگان می‌گیرد.',
  }, ['فیلم', 'گروگان'], true),
  mk(1079, '21 Grams', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، تصادف، مرگ',
    materials: 'چوب، فلز، شیشه', colors: 'خاکستری، تیره، کرم',
    lighting: 'ترکیبی', summary: 'فیلم ۲۱ گرم، وزن روح.',
  }, ['فیلم', 'درام'], true),
  mk(1080, 'Return to Me', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'رستوران، بیمارستان، عشق',
    materials: 'چوب، فلز، پارچه', colors: 'گرم، قرمز، کرم',
    lighting: 'ترکیبی', summary: 'فیلم بازگشت به من با قلب اهدایی.',
  }, ['فیلم', 'عشق'], true),
  mk(1081, 'The God Committee', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، کمیته، راز',
    materials: 'چوب، فلز، شیشه', colors: 'خاکستری، تیره، کرم',
    lighting: 'ترکیبی', summary: 'فیلم کمیته خدا برای انتخاب گیرنده.',
  }, ['فیلم', 'درام'], true),
  mk(1082, "My Sister's Keeper", CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، خانواده، دادگاه',
    materials: 'چوب، فلز، شیشه', colors: 'گرم، کرم، آبی',
    lighting: 'ترکیبی', summary: 'فیلم خواهر من نگهبان، کودک اهداکننده.',
  }, ['فیلم', 'خانواده'], true),
  mk(1083, 'Seven Pounds', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، اهدا، رستگاری',
    materials: 'چوب، فلز، شیشه', colors: 'خاکستری، تیره، کرم',
    lighting: 'ترکیبی', summary: 'فیلم هفت پوند با ویل اسمیت.',
  }, ['فیلم', 'رستگاری'], true),
  mk(1084, "The Brain That Wouldn't Die", CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'کلاسیک/سنتی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'آزمایشگاه، مغز، زنده ماندن',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، خاکستری، سبز',
    lighting: 'سرد', summary: 'فیلم کلاسیک مغزی که نمی‌مرد.',
  }, ['فیلم', 'علمی'], true),
  mk(1085, 'Diya Aur Toofan', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، هند، مغز',
    materials: 'چوب، فلز، پارچه', colors: 'گرم، قرمز، طلایی',
    lighting: 'ترکیبی', summary: 'فیلم هندی دیا و طوفان.',
  }, ['فیلم', 'هند'], true),
  mk(1086, 'The Man with Two Brains', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'آزمایشگاه، مغز، کمدی',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، خاکستری، کرم',
    lighting: 'روشن', summary: 'فیلم کمدی مرد با دو مغز.',
  }, ['فیلم', 'کمدی'], true),
  mk(1087, 'Re-Animated', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، انیمیشن، کودک',
    materials: 'فلز، شیشه، پلاستیک', colors: 'زرد، آبی، قرمز',
    lighting: 'روشن', summary: 'فیلم کودک با مغز اهدایی.',
  }, ['فیلم', 'کودک'], true),
  mk(1088, 'Heart', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، قلب، عشق',
    materials: 'چوب، فلز، شیشه', colors: 'قرمز، کرم، گرم',
    lighting: 'ترکیبی', summary: 'فیلم قلب.',
  }, ['فیلم', 'قلب'], true),
  mk(1089, 'The Harvest Project', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، قاچاق، اخلاق',
    materials: 'چوب، فلز، شیشه', colors: 'خاکستری، تیره، قرمز',
    lighting: 'ترکیبی', summary: 'فیلم پروژه برداشت قاچاق اعضا.',
  }, ['فیلم', 'قاچاق'], true),
  mk(1090, 'Inhale', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'بیمارستان، مکزیک، ریه',
    materials: 'فلز، شیشه، چوب', colors: 'خاکستری، تیره، کرم',
    lighting: 'ترکیبی', summary: 'فیلم پدری برای پیوند ریه دخترش.',
  }, ['فیلم', 'پیوند'], true),
  mk(1091, 'Man with the Transplanted Brain', CAT.ehda, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'آزمایشگاه، مغز، پیوند',
    materials: 'فلز، شیشه، پلاستیک', colors: 'سفید، خاکستری، سبز',
    lighting: 'سرد', summary: 'فیلم مرد با مغز پیوندی.',
  }, ['فیلم', 'علمی'], true),
];

export { zandanShows, ehdaShows };
