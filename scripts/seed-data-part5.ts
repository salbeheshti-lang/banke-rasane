// ============================================================================
// SEED DATA PART 5 — Tarikhi, Radio, Rusta (3 more categories)
// ============================================================================
import { CAT, NewShow, mk } from './seed-data-part1';

// ============================================================================
// 14) TARIKHI (Historical) — 15 programs — HAS DECOR
// ============================================================================
const tarikhiShows: NewShow[] = [
  // مستند تاریخی
  mk(1092, 'Civilisations', CAT.tarikhi, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'اماکن تاریخی، موزه‌ها، آثار باستانی',
    materials: 'سنگ، فلز، شیشه', colors: 'طلایی، قهوه‌ای، کرم',
    lighting: 'ترکیبی', summary: 'مستند تمدن‌های بشری از کلاسیک تا مدرن.',
  }, ['مستند', 'تمدن']),
  mk(1093, 'Evacuation', CAT.tarikhi, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'اماکن تاریخی، آرشیو، مصاحبه',
    materials: 'سنگ، چوب، فلز', colors: 'قهوه‌ای، خاکستری، کرم',
    lighting: 'ترکیبی', summary: 'مستند تخلیه در جنگ جهانی.',
  }, ['مستند', 'جنگ']),
  mk(1094, 'Electric Dreams', CAT.tarikhi, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'آرشیو، خانه‌های قدیمی، تجهیزات الکتریکی قدیمی',
    materials: 'چوب، فلز، شیشه', colors: 'قهوه‌ای، کرم، طلایی',
    lighting: 'ترکیبی', summary: 'مستند تاریخچه برق در خانه‌ها.',
  }, ['مستند', 'برق']),
  mk(1095, '10,000 BC', CAT.tarikhi, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'غارها، ابزارهای سنگی، طبیعت بکر',
    materials: 'سنگ، چوب، خاک', colors: 'خاکستری، قهوه‌ای، خاکی',
    lighting: 'خورشید طبیعی', summary: 'مستند زندگی در ۱۰ هزار سال پیش از میلاد.',
  }, ['مستند', 'پیش از تاریخ']),
  mk(1096, 'Victorian Pharmacy', CAT.tarikhi, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'کلاسیک/سنتی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'داروخانه قدیمی، شیشه‌های دارو، چوب',
    materials: 'چوب، شیشه، فلز', colors: 'قهوه‌ای، سبز، کرم',
    lighting: 'گرم', summary: 'مستند داروخانه دوران ویکتوریا.',
  }, ['مستند', 'ویکتوریا']),
  // مجموعه واقع‌نما / بازسازی تاریخی
  mk(1097, 'The 1940s House', CAT.tarikhi, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'کلاسیک/سنتی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'خانه ۱۹۴۰، مبلمان قدیمی، تزئینات',
    materials: 'چوب، پارچه، فلز', colors: 'قهوه‌ای، کرم، سبز تیره',
    lighting: 'گرم', summary: 'واقع‌نمای زندگی خانواده در خانه ۱۹۴۰.',
  }, ['واقع‌نما', 'دهه ۴۰']),
  mk(1098, 'The 70s House', CAT.tarikhi, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'خانه ۷۰، مبلمان رنگی، تزئینات',
    materials: 'پلاستیک، پارچه، چوب', colors: 'نارنجی، قهوه‌ای، زرد',
    lighting: 'گرم', summary: 'واقع‌نمای زندگی خانواده در خانه ۷۰.',
  }, ['واقع‌نما', 'دهه ۷۰']),
  mk(1099, "Churchill's Secret Agents: The New Recruits", CAT.tarikhi, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'اردوگاه نظامی، لباس ۱۹۴۰، تمرین',
    materials: 'چوب، فلز، پارچه', colors: 'سبز زیتونی، خاکی، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'واقع‌نمای جاسوسان جدید چرچیل.',
  }, ['واقع‌نما', 'جنگ']),
  mk(1100, 'Back in Time for ...', CAT.tarikhi, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'خانه با تغییر دکور، خانواده، زمان',
    materials: 'چوب، پارچه، فلز', colors: 'متنوع، گرم',
    lighting: 'ترکیبی', summary: 'واقع‌نمای خانواده‌ای که در دهه‌های مختلف زندگی می‌کنند.',
  }, ['واقع‌نما', 'دهه‌ها']),
  mk(1101, 'Back in Time for Brixton', CAT.tarikhi, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'محله بریکستون، خانه‌ها، فرهنگ',
    materials: 'چوب، پارچه، فلز', colors: 'گرم، قرمز، کرم',
    lighting: 'ترکیبی', summary: 'واقع‌نمای زندگی خانواده در بریکستون.',
  }, ['واقع‌نما', 'بریکستون']),
  mk(1102, 'Colonial House', CAT.tarikhi, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'کلاسیک/سنتی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'خانه استعماری، لباس قدیمی، طبیعت',
    materials: 'چوب، پارچه، فلز', colors: 'قهوه‌ای، کرم، سبز',
    lighting: 'خورشید طبیعی', summary: 'واقع‌نمای زندگی در دوران استعمار.',
  }, ['واقع‌نما', 'استعمار']),
  mk(1103, 'Bad Lads', CAT.tarikhi, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'پادگان، تمرین نظامی، جوانان',
    materials: 'فلز، چوب، پارچه', colors: 'سبز زیتونی، خاکی، مشکی',
    lighting: 'ترکیبی', summary: 'واقع‌نمای جوانان بدرفتار در پادگان.',
  }, ['واقع‌نما', 'اصلاح']),
  mk(1104, 'The Supersizers Go... Elizabethan', CAT.tarikhi, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'کلاسیک/سنتی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'میز غذای الیزابتی، لباس قدیمی، کمدی',
    materials: 'چوب، پارچه، فلز', colors: 'قرمز، طلایی، قهوه‌ای',
    lighting: 'گرم', summary: 'واقع‌نمای غذا در دوران الیزابت.',
  }, ['واقع‌نما', 'غذا']),
  mk(1105, "That'll Teach Em", CAT.tarikhi, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'کلاسیک/سنتی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مدرسه قدیمی، کلاس درس، لباس',
    materials: 'چوب، پارچه، فلز', colors: 'قهوه‌ای، کرم، سبز تیره',
    lighting: 'گرم', summary: 'واقع‌نمای دانش‌آموزان در مدرسه قدیمی.',
  }, ['واقع‌نما', 'مدرسه']),
  mk(1106, 'Pioneer Quest: A Year in the Real West', CAT.tarikhi, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'غرب وحشی، کلبه، طبیعت',
    materials: 'چوب، پارچه، فلز', colors: 'خاکی، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'واقع‌نمای زندگی یک سال در غرب واقعی.',
  }, ['واقع‌نما', 'غرب']),
];

// ============================================================================
// 15) RADIO (Radio & Visual Media) — 50 programs — HAS DECOR
// ============================================================================
const radioShows: NewShow[] = [
  // تاک‌شو و گفت‌وگومحور (13)
  mk(1107, 'Movies with Ali Plumb', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز اجرا، میکروفون، نمایشگر',
    materials: 'چوب، فلز، شیشه', colors: 'مشکی، قرمز، کرم',
    lighting: 'ترکیبی', summary: 'تاک‌شوی فیلم با علی پلامب.',
  }, ['تاک‌شو', 'فیلم']),
  mk(1108, 'Movies with Ali Plumb: Movies That Make Me', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز اجرا، مهمان، فیلم',
    materials: 'چوب، فلز، شیشه', colors: 'مشکی، قرمز، کرم',
    lighting: 'ترکیبی', summary: 'تاک‌شوی فیلم‌هایی که من را ساختند.',
  }, ['تاک‌شو', 'فیلم']),
  mk(1109, 'Music Life', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، میکروفون، موسیقی',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، مشکی، کرم',
    lighting: 'ترکیبی', summary: 'تاک‌شوی زندگی موسیقایی.',
  }, ['تاک‌شو', 'موسیقی']),
  mk(1110, 'What Planet Are We On? With Liz Bonnin', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، طبیعت، مصاحبه',
    materials: 'چوب، فلز، شیشه', colors: 'سبز، آبی، کرم',
    lighting: 'ترکیبی', summary: 'تاک‌شوی محیط زیست با لیز بونین.',
  }, ['تاک‌شو', 'محیط زیست']),
  mk(1111, 'One Fine Day with Lena Park', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، موسیقی، میز',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، کرم، مشکی',
    lighting: 'گرم', summary: 'تاک‌شوی یک روز خوب با لنا پارک.',
  }, ['تاک‌شو', 'موسیقی']),
  mk(1112, 'Financial Matters', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، نمایشگر، میز',
    materials: 'فلز، شیشه، چوب', colors: 'آبی، خاکستری، کرم',
    lighting: 'روشن', summary: 'تاک‌شوی مسائل مالی.',
  }, ['تاک‌شو', 'مالی']),
  mk(1113, 'Investment School', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، نمایشگر، میز',
    materials: 'فلز، شیشه، چوب', colors: 'آبی، خاکستری، سبز',
    lighting: 'روشن', summary: 'تاک‌شوی مدرسه سرمایه‌گذاری.',
  }, ['تاک‌شو', 'سرمایه‌گذاری']),
  mk(1114, 'Investec Working Lunch with Arabile Gumede', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'میز ناهار، میکروفون، نمایشگر',
    materials: 'چوب، فلز، شیشه', colors: 'آبی، کرم، خاکستری',
    lighting: 'روشن', summary: 'تاک‌شوی ناهار کاری Investec.',
  }, ['تاک‌شو', 'مالی']),
  mk(1115, 'Public Have Their Say', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'پنل/میزگرد', elements: 'میز پنل، تماشاگران، میکروفون',
    materials: 'چوب، فلز، پارچه', colors: 'آبی، کرم، قرمز',
    lighting: 'روشن', summary: 'تاک‌شوی جامعه و نظر مردم.',
  }, ['تاک‌شو', 'مردم']),
  mk(1116, 'The Exit Interviews', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، میز، آرشیو',
    materials: 'چوب، فلز، شیشه', colors: 'خاکستری، کرم، مشکی',
    lighting: 'ترکیبی', summary: 'تاک‌شوی مصاحبه‌های خروج.',
  }, ['تاک‌شو', 'مصاحبه']),
  mk(1117, 'Jane and Fi', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، میز، موسیقی',
    materials: 'چوب، فلز، پارچه', colors: 'گرم، کرم، قرمز',
    lighting: 'گرم', summary: 'تاک‌شوی جین و فی.',
  }, ['تاک‌شو', 'زنان']),
  mk(1118, 'To the Point', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'پنل/میزگرد', elements: 'میز پنل، نمایشگر، میکروفون',
    materials: 'فلز، شیشه، چوب', colors: 'آبی، خاکستری، قرمز',
    lighting: 'روشن', summary: 'تاک‌شوی به نکته با پنل خبری.',
  }, ['تاک‌شو', 'خبری']),
  mk(1119, 'To The Point', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'پنل/میزگرد', elements: 'میز پنل، نمایشگر، میکروفون',
    materials: 'فلز، شیشه، چوب', colors: 'آبی، خاکستری، قرمز',
    lighting: 'روشن', summary: 'تاک‌شوی خبری To The Point.',
  }, ['تاک‌شو', 'خبری']),
  // برنامه سرگرمی و طنز (12)
  mk(1120, 'Celeb LOLs', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه کمدی، سلبریتی، تماشاگر',
    materials: 'فلز، شیشه، پارچه', colors: 'زرد، قرمز، بنفش',
    lighting: 'ترکیبی', summary: 'برنامه طنز سلبریتی‌ها.',
  }, ['طنز', 'سلبریتی']),
  mk(1121, "Radio 1's Innuendo Bingo", CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'میز بازی، تماشاگر، آب',
    materials: 'پلاستیک، فلز، پارچه', colors: 'آبی، زرد، قرمز',
    lighting: 'روشن', summary: 'بingo با کنایه‌های رادیو ۱.',
  }, ['طنز', 'بازی']),
  mk(1122, "BBC Radio 1's Unpopular Opinion", CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، میز، میکروفون',
    materials: 'چوب، فلز، شیشه', colors: 'قرمز، مشکی، کرم',
    lighting: 'ترکیبی', summary: 'نظرات ناپسند BBC Radio 1.',
  }, ['طنز', 'نظر']),
  mk(1123, "BBC Radio 1's Playground Insults", CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، دو نفر، کمدی',
    materials: 'چوب، فلز، پارچه', colors: 'زرد، قرمز، مشکی',
    lighting: 'روشن', summary: 'توهین‌های فضای بازی Radio 1.',
  }, ['طنز', 'توهین']),
  mk(1124, 'Sounds Good / Sounds Bad', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه، میکروفون، تماشاگر',
    materials: 'فلز، پارچه، چوب', colors: 'سبز، قرمز، کرم',
    lighting: 'ترکیبی', summary: 'برنامه صداهای خوب و بد.',
  }, ['طنز', 'صدا']),
  mk(1125, 'Pressed', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، نمایشگر، میز',
    materials: 'فلز، شیشه، چوب', colors: 'خاکستری، مشکی، نارنجی',
    lighting: 'ترکیبی', summary: 'برنامه پرسش و پاسخ سریع.',
  }, ['طنز', 'سریع']),
  mk(1126, 'Bad People', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، دو نفر، کمدی',
    materials: 'چوب، فلز، پارچه', colors: 'مشکی، قرمز، کرم',
    lighting: 'ترکیبی', summary: 'برنامه کمدی افراد بد.',
  }, ['طنز', 'کمدی']),
  mk(1127, 'Wheel of Misfortune', CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'چرخ بزرگ، تماشاگر، کمدی',
    materials: 'فلز، شیشه، پارچه', colors: 'زرد، قرمز، بنفش',
    lighting: 'ترکیبی', summary: 'چرخ بدشانسی با کمدی.',
  }, ['طنز', 'بازی']),
  mk(1128, 'Comedians VS The News', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'پنل/میزگرد', elements: 'میز پنل، نمایشگر اخبار، کمدین',
    materials: 'فلز، شیشه، چوب', colors: 'زرد، آبی، قرمز',
    lighting: 'ترکیبی', summary: 'کمدین‌ها در برابر اخبار.',
  }, ['طنز', 'اخبار']),
  mk(1129, 'If You Don\'t Know', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه، تماشاگر، کمدی',
    materials: 'فلز، پارچه، چوب', colors: 'زرد، بنفش، کرم',
    lighting: 'ترکیبی', summary: 'اگر نمی‌دونی، طنز.',
  }, ['طنز', 'کمدی']),
  mk(1130, 'The Harry and Meghan Netflix Show', CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، قلعه، آرشیو',
    materials: 'چوب، فلز، شیشه', colors: 'طلایی، کرم، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'نمایش هری و مگان نتفلیکس.',
  }, ['طنز', 'سلبریتی']),
  // برنامه موسیقی (8)
  mk(1131, "Radio 1's Big Weekend", CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه بزرگ موسیقی، تماشاگران، نورپردازی',
    materials: 'فلز، شیشه، LED', colors: 'طلایی، نئون، بنفش',
    lighting: 'ترکیبی', summary: 'فستیوال موسیقی Big Weekend رادیو ۱.',
  }, ['موسیقی', 'فستیوال']),
  mk(1132, 'Radio 1 Sound of 2023', CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه موسیقی، هنرمندان، تماشاگر',
    materials: 'فلز، شیشه، LED', colors: 'طلایی، نئون، صورتی',
    lighting: 'ترکیبی', summary: 'صدای ۲۰۲۳ رادیو ۱.',
  }, ['موسیقی', '۲۰۲۳']),
  mk(1133, 'Radio 1 Live Lounge', CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'استودیو موسیقی، سازها، تماشاگر',
    materials: 'چوب، فلز، شیشه', colors: 'قرمز، مشکی، کرم',
    lighting: 'ترکیبی', summary: 'Live Lounge رادیو ۱.',
  }, ['موسیقی', 'زنده']),
  mk(1134, 'The Live Lounge', CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'استودیو موسیقی، سازها، تماشاگر',
    materials: 'چوب، فلز، شیشه', colors: 'قرمز، مشکی، کرم',
    lighting: 'ترکیبی', summary: 'Live Lounge موسیقی زنده.',
  }, ['موسیقی', 'زنده']),
  mk(1135, 'Hot K-Pop Star', CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه K-Pop، رقص، نورپردازی',
    materials: 'فلز، شیشه، LED', colors: 'صورتی، نئون، بنفش',
    lighting: 'ترکیبی', summary: 'ستاره‌های Hot K-Pop.',
  }, ['موسیقی', 'K-Pop']),
  mk(1136, 'K-Pop Connection', CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'فاخر/تزئینی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه K-Pop، موسیقی، رقص',
    materials: 'فلز، شیشه، LED', colors: 'صورتی، نئون، آبی',
    lighting: 'ترکیبی', summary: 'اتصال K-Pop.',
  }, ['موسیقی', 'K-Pop']),
  mk(1137, 'Afropop Worldwide', CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه موسیقی آفریقایی، سازها، رقص',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، زرد، سبز',
    lighting: 'خورشید طبیعی', summary: 'موسقی آفریقایی Afropop.',
  }, ['موسیقی', 'آفریقا']),
  mk(1138, 'Afropop Worldwide in Africa', CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'محیط آفریقایی، موسیقی، فرهنگ',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، زرد، سبز',
    lighting: 'خورشید طبیعی', summary: 'Afropop در آفریقا.',
  }, ['موسیقی', 'آفریقا']),
  // پادکست (6)
  mk(1139, '13 Minutes to the Moon', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، آرشیو، ماه',
    materials: 'چوب، فلز، شیشه', colors: 'مشکی، نقره‌ای، آبی',
    lighting: 'سرد', summary: 'پادکست ۱۳ دقیقه تا ماه.',
  }, ['پادکست', 'ناسا']),
  mk(1140, 'That Peter Crouch Podcast', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، میکروفون، میز',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، کرم، مشکی',
    lighting: 'گرم', summary: 'پادکست پیتر کراچ.',
  }, ['پادکست', 'ورزش']),
  mk(1141, 'Global Audiobook: Once Upon a Time in Korea', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، کتاب، صدا',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، کرم، مشکی',
    lighting: 'گرم', summary: 'کتاب صوتی یک روز در کره.',
  }, ['پادکست', 'کره']),
  mk(1142, 'Planet Hope Podcast: Global Experts on Preserving Our Planet', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، میکروفون، طبیعت',
    materials: 'چوب، فلز، شیشه', colors: 'سبز، آبی، کرم',
    lighting: 'ترکیبی', summary: 'پادکست امید سیاره با کارشناسان جهانی.',
  }, ['پادکست', 'محیط زیست']),
  mk(1143, 'Stories of Our Times', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، داستان، صدا',
    materials: 'چوب، فلز، پارچه', colors: 'گرم، کرم، قرمز',
    lighting: 'گرم', summary: 'پادکست داستان‌های زمانه ما.',
  }, ['پادکست', 'داستان']),
  mk(1144, 'Snap Judgment', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، موسیقی، داستان',
    materials: 'چوب، فلز، پارچه', colors: 'قرمز، مشکی، کرم',
    lighting: 'ترکیبی', summary: 'پادکست Snap Judgment با داستان.',
  }, ['پادکست', 'داستان']),
  // برنامه خبری و تحلیلی (11)
  mk(1145, 'Multilingual News', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'میز خبری، نمایشگر، میکروفون',
    materials: 'فلز، شیشه، چوب', colors: 'آبی، قرمز، سفید',
    lighting: 'روشن', summary: 'اخبار چندزبانه.',
  }, ['خبری', 'چندزبانه']),
  mk(1146, 'Korea24', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'میز خبری، نمایشگر، میکروفون',
    materials: 'فلز، شیشه، چوب', colors: 'آبی، سفید، قرمز',
    lighting: 'روشن', summary: 'اخبار کره ۲۴.',
  }, ['خبری', 'کره']),
  mk(1147, 'K702 Small Business Awards with Lulalend', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'میز اجرا، نمایشگر، تماشاگر',
    materials: 'فلز، شیشه، چوب', colors: 'طلایی، آبی، کرم',
    lighting: 'روشن', summary: 'جوایز کسب‌وکار کوچک K702.',
  }, ['خبری', 'کسب‌وکار']),
  mk(1148, 'The Dis-Chem Brain of 702', CAT.radio, {
    size: 'بزرگ/لوکس', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'صحنه مسابقه، تماشاگر، نمایشگر',
    materials: 'فلز، شیشه، پارچه', colors: 'طلایی، قرمز، آبی',
    lighting: 'ترکیبی', summary: 'مسابقه مغز Dis-Chem 702.',
  }, ['خبری', 'مسابقه']),
  mk(1149, 'Africa Connected Visits Kenya', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'محیط کنیا، فرهنگ، تکنولوژی',
    materials: 'چوب، فلز، شیشه', colors: 'سبز، قرمز، کرم',
    lighting: 'خورشید طبیعی', summary: 'آفریقا متصل در کنیا.',
  }, ['خبری', 'کنیا']),
  mk(1150, 'Africa Connected', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'آفریقا، تکنولوژی، فرهنگ',
    materials: 'چوب، فلز، شیشه', colors: 'سبز، زرد، قرمز',
    lighting: 'خورشید طبیعی', summary: 'آفریقا متصل.',
  }, ['خبری', 'آفریقا']),
  mk(1151, 'Ashes Predictions', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'پنل/میزگرد', elements: 'میز پنل، نمایشگر، کریکت',
    materials: 'فلز، شیشه، چوب', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'روشن', summary: 'پیش‌بینی‌های Ashes کریکت.',
  }, ['خبری', 'ورزش']),
  mk(1152, 'Ukraine War: On the Ground Interviews', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'محل جنگ، مصاحبه، آرشیو',
    materials: 'سنگ، فلز، چوب', colors: 'خاکستری، زرد، آبی',
    lighting: 'ترکیبی', summary: 'مصاحبه‌های زمینی جنگ اوکراین.',
  }, ['خبری', 'جنگ']),
  mk(1153, 'Frontline: The War in Ukraine and Global Security', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، نقشه، آرشیو',
    materials: 'فلز، شیشه، چوب', colors: 'خاکستری، آبی، قرمز',
    lighting: 'ترکیبی', summary: 'Frontline جنگ اوکراین و امنیت جهانی.',
  }, ['خبری', 'امنیت']),
  mk(1154, 'China: Understanding a Superpower', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، آرشیو، چین',
    materials: 'چوب، فلز، شیشه', colors: 'قرمز، زرد، مشکی',
    lighting: 'ترکیبی', summary: 'چین: درک یک ابرقدرت.',
  }, ['خبری', 'چین']),
  mk(1155, 'History on Times Radio', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، آرشیو، تاریخ',
    materials: 'چوب، فلز، شیشه', colors: 'قهوه‌ای، کرم، طلایی',
    lighting: 'گرم', summary: 'تاریخ در Times Radio.',
  }, ['خبری', 'تاریخ']),
  mk(1156, 'As It Happens', CAT.radio, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'مدرن', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، میکروفون، تلفن',
    materials: 'فلز، شیشه، چوب', colors: 'آبی، قرمز، سفید',
    lighting: 'روشن', summary: 'اخبار As It Happens.',
  }, ['خبری', 'زنده']),
];

export { tarikhiShows, radioShows };
