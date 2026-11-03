// ============================================================================
// SEED DATA PART 7 — Ketab (Book & Literary) — 30 programs — HAS DECOR
// ============================================================================
import { CAT, NewShow, mk } from './seed-data-part1';

const ketabShows: NewShow[] = [
  // 1. تاک‌شو ادبی و گفت‌وگو محور (9)
  mk(1201, 'Between the Covers', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز اجرا، کتاب، میکروفون، صندلی',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، کرم، قهوه‌ای',
    lighting: 'گرم', summary: 'تاک‌شوی ادبی با مصاحبه نویسندگان و نقد کتاب.',
  }, ['تاک‌شو', 'ادبی', 'مصاحبه']),
  mk(1202, 'Nowadays Bookstore: I Will Read Books', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'کتابفروشی، قفسه کتاب، میز اجرا',
    materials: 'چوب، فلز، پارچه', colors: 'قهوه‌ای، کرم، سبز',
    lighting: 'گرم', summary: 'معرفی کتاب و گفت‌وگوی ادبی از یک کتابفروشی.',
  }, ['تاک‌شو', 'کتابفروشی']),
  mk(1203, 'PA Books', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز اجرا، کتاب، میکروفون',
    materials: 'چوب، فلز، شیشه', colors: 'آبی، کرم، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'مصاحبه با نویسندگان و گفت‌وگوی تاریخی فرهنگی.',
  }, ['تاک‌شو', 'تاریخی']),
  mk(1204, 'Mary Walsh: Open Book', CAT.ketab, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'پنل/میزگرد', elements: 'میز پنل، تماشاگر، قفسه کتاب',
    materials: 'چوب، فلز، شیشه', colors: 'قرمز، کرم، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'میزگرد ادبی با مریم والش و نقد کتاب.',
  }, ['تاک‌شو', 'پنل']),
  mk(1205, 'BookTube', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، نمایشگر، کتاب',
    materials: 'فلز، شیشه، چوب', colors: 'قرمز، مشکی، کرم',
    lighting: 'ترکیبی', summary: 'تاک‌شوی آنلاین BookTube برای معرفی کتاب.',
  }, ['تاک‌شو', 'دیجیتال']),
  mk(1206, 'After Words', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز اجرا، کتاب، میکروفون',
    materials: 'چوب، فلز، پارچه', colors: 'آبی، کرم، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'مصاحبه تخصصی و گفت‌وگوی عمیق با نویسندگان.',
  }, ['تاک‌شو', 'تخصصی']),
  mk(1207, 'Apostrophes', CAT.ketab, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'کلاسیک/سنتی', effects: 'ترکیبی',
    layout: 'پنل/میزگرد', elements: 'میز پنل، تماشاگر، قفسه کتاب',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، کرم، طلایی',
    lighting: 'گرم', summary: 'برنامه فرانسوی کلاسیک میزگرد ادبی با نویسندگان.',
  }, ['تاک‌شو', 'فرانسه']),
  mk(1208, 'Jennifer Byrne Presents', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز اجرا، کتاب، صندلی',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، کرم، قهوه‌ای',
    lighting: 'گرم', summary: 'مصاحبه با نویسندگان و معرفی آثار برجسته.',
  }, ['تاک‌شو', 'استرالیا']),
  mk(1209, 'Hot Type', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز اجرا، کتاب، میکروفون',
    materials: 'چوب، فلز، شیشه', colors: 'قرمز، مشکی، کرم',
    lighting: 'ترکیبی', summary: 'گفت‌وگوی فرهنگی و نقد و بررسی ادبی.',
  }, ['تاک‌شو', 'نقد']),
  // 2. باشگاه کتاب و گفت‌وگوی گروهی (5)
  mk(1210, 'Secret Readers Club', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'پنل/میزگرد', elements: 'میز پنل، کتاب، تماشاگر',
    materials: 'چوب، فلز، پارچه', colors: 'بنفش، کرم، قرمز',
    lighting: 'ترکیبی', summary: 'باشگاه کتاب با رئالیتی‌شو و گفت‌وگوی گروهی.',
  }, ['باشگاه کتاب', 'رئالیتی']),
  mk(1211, 'Tuesday Night Book Club', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'پنل/میزگرد', elements: 'میز پنل، کتاب، صندلی',
    materials: 'چوب، فلز، پارچه', colors: 'آبی، کرم، قهوه‌ای',
    lighting: 'گرم', summary: 'باشگاه کتاب سه‌شنبه شب با گفت‌وگوی گروهی.',
  }, ['باشگاه کتاب', 'گروهی']),
  mk(1212, 'The Book Club / First Tuesday Book Club', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'پنل/میزگرد', elements: 'میز پنل، کتاب، تماشاگر',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، کرم، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'میزگرد ادبی با نقد گروهی و معرفی کتاب.',
  }, ['باشگاه کتاب', 'نقد']),
  mk(1213, "Oprah's Book Club", CAT.ketab, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه بزرگ، تماشاگر، کتاب، نورپردازی',
    materials: 'فلز، شیشه، پارچه', colors: 'طلایی، قرمز، کرم',
    lighting: 'ترکیبی', summary: 'باشگاه کتاب اپرا با معرفی آثار منتخب.',
  }, ['باشگاه کتاب', 'اپرا']),
  mk(1214, 'Sky Arts Book Club Live', CAT.ketab, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه، تماشاگر، کتاب، نمایشگر',
    materials: 'فلز، شیشه، پارچه', colors: 'آبی، بنفش، کرم',
    lighting: 'ترکیبی', summary: 'باشگاه کتاب زنده Sky Arts با تعامل با مخاطب.',
  }, ['باشگاه کتاب', 'زنده']),
  // 3. مستند ادبی، تاریخی و فرهنگی (5)
  mk(1215, 'The Beauty of Books', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'کتابخانه، کتاب‌های قدیمی، آرشیو',
    materials: 'چوب، چرم، فلز', colors: 'قهوه‌ای، طلایی، کرم',
    lighting: 'گرم', summary: 'مستند زیبایی کتاب و میراث فرهنگی.',
  }, ['مستند', 'میراث']),
  mk(1216, 'Treasures of the British Library', CAT.ketab, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'کتابخانه بریتانیا، گنجینه، کتاب‌های قدیمی',
    materials: 'سنگ، چوب، چرم', colors: 'طلایی، قهوه‌ای، کرم',
    lighting: 'ترکیبی', summary: 'مستند گنجینه‌های کتابخانه بریتانیا.',
  }, ['مستند', 'بریتانیا']),
  mk(1217, 'Books That Shaped America', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'آرشیو، کتاب، مصاحبه',
    materials: 'چوب، فلز، شیشه', colors: 'قرمز، آبی، کرم',
    lighting: 'ترکیبی', summary: 'مستند کتاب‌هایی که آمریکا را شکل دادند.',
  }, ['مستند', 'آمریکا']),
  mk(1218, 'The Secret Life of Books', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'کتابخانه، آرشیو، پشت صحنه',
    materials: 'چوب، چرم، فلز', colors: 'قهوه‌ای، کرم، طلایی',
    lighting: 'ترکیبی', summary: 'مستند پشت صحنه شکل‌گیری آثار ادبی.',
  }, ['مستند', 'پشت صحنه']),
  mk(1219, 'Great Books', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'کتابخانه، مصاحبه، آرشیو',
    materials: 'چوب، فلز، شیشه', colors: 'قهوه‌ای، طلایی، کرم',
    lighting: 'ترکیبی', summary: 'مستند تحلیل آثار برجسته و زندگینامه نویسندگان.',
  }, ['مستند', 'زندگینامه']),
  // 4. مسابقه و رقابت کتاب‌خوانی (3)
  mk(1220, 'Canada Reads', CAT.ketab, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه مسابقه، داوران، تماشاگر',
    materials: 'فلز، شیشه، پارچه', colors: 'قرمز، سفید، کرم',
    lighting: 'ترکیبی', summary: 'رقابت ادبی Canada Reads و انتخاب کتاب برتر.',
  }, ['مسابقه', 'کانادا']),
  mk(1221, 'The Great American Read', CAT.ketab, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه بزرگ، نمایشگر، تماشاگر',
    materials: 'فلز، شیشه، پارچه', colors: 'آبی، قرمز، سفید',
    lighting: 'ترکیبی', summary: 'مستند مسابقه‌ای با نظرسنجی عمومی برای انتخاب کتاب محبوب.',
  }, ['مسابقه', 'آمریکا']),
  mk(1222, 'The Book Quiz', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'میز مسابقه، نمایشگر، تایمر',
    materials: 'فلز، شیشه، چوب', colors: 'آبی، زرد، قرمز',
    lighting: 'روشن', summary: 'مسابقه اطلاعات عمومی و دانش ادبی.',
  }, ['مسابقه', 'آموزشی']),
  // 5. برنامه کودک و نوجوان و آموزش کتاب‌خوانی (4)
  mk(1223, 'The Book Place', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'میز کودک، کتاب، رنگ‌آمیزی',
    materials: 'چوب، پلاستیک، پارچه', colors: 'زرد، آبی، قرمز',
    lighting: 'روشن', summary: 'آموزش کتاب‌خوانی و معرفی کتاب کودک.',
  }, ['کودک', 'آموزشی']),
  mk(1224, 'Bookmarks', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'صحنه کودک، کتاب، داستان',
    materials: 'چوب، پارچه، پلاستیک', colors: 'زرد، قرمز، آبی',
    lighting: 'روشن', summary: 'کتاب‌خوانی نمایشی و روایت داستان برای کودکان.',
  }, ['کودک', 'داستان']),
  mk(1225, 'The Book Tower', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'برج کتاب، صحنه کودک، داستان',
    materials: 'چوب، پلاستیک، پارچه', colors: 'زرد، سبز، آبی',
    lighting: 'روشن', summary: 'برنامه نمایشی کودک با آموزش و معرفی کتاب.',
  }, ['کودک', 'نمایشی']),
  mk(1226, 'Bringing Books to Life', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'انیمیشن، داستان، کتاب',
    materials: 'پلاستیک، پارچه، فلز', colors: 'زرد، قرمز، آبی',
    lighting: 'روشن', summary: 'انیمیشن و روایت داستان با اقتباس نمایشی از کتاب.',
  }, ['کودک', 'انیمیشن']),
  // 6. رئالیتی‌شو و مستند سرگرمی (1)
  mk(1227, 'Comic Book Men', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مغازه کمیک، قفسه، مجموعه‌دار',
    materials: 'چوب، فلز، پلاستیک', colors: 'زرد، قرمز، آبی',
    lighting: 'روشن', summary: 'رئالیتی‌شو و فرهنگ کمیک بوک با مجموعه‌داران.',
  }, ['رئالیتی', 'کمیک']),
  // 7. مجله تلویزیونی فرهنگی (3)
  mk(1228, 'Book TV', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'استودیو، مصاحبه، گزارش',
    materials: 'چوب، فلز، شیشه', colors: 'آبی، کرم، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'مجله تلویزیونی معرفی کتاب و پوشش رویدادهای ادبی.',
  }, ['مجله', 'فرهنگی']),
  mk(1229, 'Imprint', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'استودیو، کتاب، مصاحبه',
    materials: 'چوب، فلز، شیشه', colors: 'قرمز، کرم، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'مجله فرهنگی با معرفی کتاب و تحلیل ادبی.',
  }, ['مجله', 'ادبی']),
  mk(1230, 'Read With Jenna', CAT.ketab, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز اجرا، کتاب، صندلی',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، کرم، قهوه‌ای',
    lighting: 'گرم', summary: 'معرفی و پیشنهاد کتاب با مصاحبه نویسندگان.',
  }, ['مجله', 'تاک‌شو']),
];

export { ketabShows };
