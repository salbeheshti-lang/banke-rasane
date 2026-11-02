// ============================================================================
// SEED DATA PART 6 — Rusta (Rural & Village)
// ============================================================================
import { CAT, NewShow, mk } from './seed-data-part1';

// ============================================================================
// 16) RUSTA (Rural & Village) — 95 programs — HAS DECOR
// ============================================================================
const rustaShows: NewShow[] = [
  // مستند (16)
  mk(1157, 'American Farmer', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه، تراکتور، طبیعت',
    materials: 'فلز، چوب، خاک', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند کشاورز آمریکایی.',
  }, ['مستند', 'کشاورزی']),
  mk(1158, 'The American Farm', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه، خانواده، تراکتور',
    materials: 'فلز، چوب، خاک', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند مزرعه آمریکایی.',
  }, ['مستند', 'مزرعه']),
  mk(1159, 'Honeyland', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'کوه، زنبورستان، روستا',
    materials: 'چوب، خاک، فلز', colors: 'طلایی، قهوه‌ای، سبز',
    lighting: 'خورشید طبیعی', summary: 'مستند زنبوردار زن در مقدونیا.',
  }, ['مستند', 'زنبوردار']),
  mk(1160, 'Farmland', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزارع، جوانان، کشاورزی',
    materials: 'فلز، چوب، خاک', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند مزارع با جوانان کشاورز.',
  }, ['مستند', 'جوانان']),
  mk(1161, 'The Biggest Little Farm', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه، حیوانات، طبیعت',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند بزرگترین مزرعه کوچک.',
  }, ['مستند', 'مزرعه']),
  mk(1162, 'The Real Dirt on Farmer John', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه، کشاورز، آرشیو',
    materials: 'چوب، فلز، خاک', colors: 'قهوه‌ای، سبز، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند خاک واقعی کشاورز جان.',
  }, ['مستند', 'کشاورز']),
  mk(1163, 'Kiss the Ground', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'موقعیت‌محور', elements: 'خاک، طبیعت، کشاورزی پایدار',
    materials: 'خاک، چوب، فلز', colors: 'قهوه‌ای، سبز، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند بوسه زمین دربارهٔ خاک.',
  }, ['مستند', 'خاک']),
  mk(1164, 'Happy People: A Year in the Taiga', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'تایگا، شکار، طبیعت وحشی',
    materials: 'چوب، فلز، پارچه', colors: 'سفید، قهوه‌ای، خاکستری',
    lighting: 'خورشید طبیعی', summary: 'مستند مردم خوشحال در تایگا.',
  }, ['مستند', 'تایگا']),
  mk(1165, 'The Silent Village', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'روستای ساکت، خانه‌ها، طبیعت',
    materials: 'سنگ، چوب، خاک', colors: 'خاکستری، سبز، قهوه‌ای',
    lighting: 'ترکیبی', summary: 'مستند روستای ساکت.',
  }, ['مستند', 'روستا']),
  mk(1166, 'Visages Villages (Faces Places)', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'روستا، عکس، هنر',
    materials: 'چوب، فلز، پارچه', colors: 'متنوع، سیاه و سفید',
    lighting: 'خورشید طبیعی', summary: 'مستند چهره‌ها و روستاها.',
  }, ['مستند', 'هنر']),
  mk(1167, 'To Be and to Have', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مدرسه روستایی، کودکان، معلم',
    materials: 'چوب، فلز، پارچه', colors: 'گرم، قهوه‌ای، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند بودن و داشتن.',
  }, ['مستند', 'مدرسه']),
  mk(1168, 'Rural Heritage', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'کلاسیک/سنتی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'روستا، میراث، سنتی',
    materials: 'چوب، سنگ، فلز', colors: 'قهوه‌ای، کرم، سبز',
    lighting: 'خورشید طبیعی', summary: 'مستند میراث روستایی.',
  }, ['مستند', 'میراث']),
  mk(1169, 'Washington Grown', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزارع واشنگتن، محصولات، کشاورزان',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند محصولات واشنگتن.',
  }, ['مستند', 'واشنگتن']),
  mk(1170, 'The Rural Americans', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'روستاهای آمریکا، مردم، فرهنگ',
    materials: 'چوب، فلز، پارچه', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند آمریکایی‌های روستایی.',
  }, ['مستند', 'آمریکا']),
  mk(1171, "France's Mythical Places", CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'فاخر/تزئینی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'اماکن اسطوره‌ای فرانسه، قلعه، طبیعت',
    materials: 'سنگ، چوب، فلز', colors: 'طلایی، سبز، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند اماکن اسطوره‌ای فرانسه.',
  }, ['مستند', 'فرانسه']),
  mk(1172, 'Small Village Story Italy', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'روستای ایتالیایی، فرهنگ، تاریخ',
    materials: 'سنگ، چوب، فلز', colors: 'قرمز، سبز، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند داستان روستای کوچک ایتالیا.',
  }, ['مستند', 'ایتالیا']),
  // مستند حیات روستایی و کشاورزی (27)
  mk(1173, 'This Week on the Farm', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه، حیوانات، کشاورز',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند این هفته در مزرعه.',
  }, ['مستند', 'مزرعه']),
  mk(1174, 'Countryfile', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'حومه بریتانیا، طبیعت، کشاورزی',
    materials: 'سنگ، چوب، فلز', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند Countryfile بریتانیا.',
  }, ['مستند', 'بریتانیا']),
  mk(1175, 'Springtime on the Farm', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه بهاری، تولد حیوانات، کشاورز',
    materials: 'چوب، فلز، خاک', colors: 'سبز روشن، صورتی، زرد',
    lighting: 'خورشید طبیعی', summary: 'مستند بهار در مزرعه.',
  }, ['مستند', 'بهار']),
  mk(1176, 'Texas Agriculture Matters', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزارع تگزاس، چارپایان، کشاورزی',
    materials: 'چوب، فلز، خاک', colors: 'قهوه‌ای، قرمز، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند کشاورزی تگزاس.',
  }, ['مستند', 'تگزاس']),
  mk(1177, 'Maryland Farm & Harvest', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزارع مریلند، برداشت، کشاورز',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، طلایی',
    lighting: 'خورشید طبیعی', summary: 'مستند مزرعه و برداشت مریلند.',
  }, ['مستند', 'مریلند']),
  mk(1178, 'This Week in Louisiana Agriculture', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزارع لوئیزیانا، کشاورزی، فرهنگ',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند کشاورزی لوئیزیانا در این هفته.',
  }, ['مستند', 'لوئیزیانا']),
  mk(1179, 'Farmweek', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزارع، اخبار کشاورزی، کشاورز',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند هفته کشاورزی.',
  }, ['مستند', 'هفته']),
  mk(1180, 'Sunup TV', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'طلوع آفتاب، مزرعه، کشاورزی',
    materials: 'چوب، فلز، خاک', colors: 'نارنجی، زرد، سبز',
    lighting: 'خورشید طبیعی', summary: 'مستند Sunup TV کشاورزی.',
  }, ['مستند', 'طلوع']),
  mk(1181, 'U.S. Farm Report', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'استودیو، مزرعه، کشاورز',
    materials: 'چوب، فلز، شیشه', colors: 'سبز، آبی، قهوه‌ای',
    lighting: 'روشن', summary: 'گزارش کشاورزی آمریکا.',
  }, ['مستند', 'گزارش']),
  mk(1182, 'Rural Delivery', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'تحویل روستایی، مزرعه، کشاورز',
    materials: 'چوب، فلز، پارچه', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند تحویل روستایی.',
  }, ['مستند', 'تحویل']),
  mk(1183, 'This Farming Life', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'زندگی کشاورزی، خانواده، طبیعت',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند زندگی کشاورزی.',
  }, ['مستند', 'زندگی']),
  mk(1184, 'Born Mucky: Life on the Farm', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه، گل آلود، زندگی روزمره',
    materials: 'چوب، فلز، خاک', colors: 'قهوه‌ای، سبز، خاکستری',
    lighting: 'خورشید طبیعی', summary: 'مستند کثیف به دنیا آمدن در مزرعه.',
  }, ['مستند', 'مزرعه']),
  mk(1185, 'Follow the Food', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'زنجیره غذا، مزرعه، حمل‌ونقل',
    materials: 'چوب، فلز، پلاستیک', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند دنبال کردن غذا.',
  }, ['مستند', 'غذا']),
  mk(1186, 'Virginia Farming', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزارع ویرجینیا، کشاورز، طبیعت',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند کشاورزی ویرجینیا.',
  }, ['مستند', 'ویرجینیا']),
  mk(1187, 'Shamba Shape Up', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه آفریقایی، بهبود، کشاورز',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند بهبود مزرعه شامبا.',
  }, ['مستند', 'آفریقا']),
  mk(1188, 'FarmHer', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه، زن کشاورز، طبیعت',
    materials: 'چوب، فلز، خاک', colors: 'سبز، صورتی، قهوه‌ای',
    lighting: 'خورشید طبیعی', summary: 'مستند کشاورز زن.',
  }, ['مستند', 'زنان']),
  mk(1189, 'Wild Shepherdess with Kate Humble', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'چوپان، کوه، گله',
    materials: 'چوب، فلز، پارچه', colors: 'سبز، قهوه‌ای، خاکستری',
    lighting: 'خورشید طبیعی', summary: 'مستند چوپان وحشی با کیت هامبل.',
  }, ['مستند', 'چوپان']),
  mk(1190, 'RanchHer', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'رنچ، زن، چارپایان',
    materials: 'چوب، فلز، پارچه', colors: 'قهوه‌ای، قرمز، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند زن رنچ‌دار.',
  }, ['مستند', 'رنچ']),
  mk(1191, 'Mná na Talún', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه ایرلند، زنان، کشاورزی',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند زنان مزرعه ایرلند.',
  }, ['مستند', 'ایرلند']),
  mk(1192, 'Rare Breed: A Farming Year', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'نژاد نادر، مزرعه، سال کشاورزی',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند نژاد نادر در سال کشاورزی.',
  }, ['مستند', 'نژاد']),
  mk(1193, 'Around the Farm Table', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'میز غذا، مزرعه، آشپزی',
    materials: 'چوب، فلز، پارچه', colors: 'گرم، کرم، قهوه‌ای',
    lighting: 'خورشید طبیعی', summary: 'مستند دور میز مزرعه.',
  }, ['مستند', 'غذا']),
  mk(1194, 'Meet the Farmer TV', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'مصاحبه یک‌به‌یک', elements: 'مزرعه، کشاورز، مصاحبه',
    materials: 'چوب، فلز، شیشه', colors: 'سبز، قهوه‌ای، کرم',
    lighting: 'خورشید طبیعی', summary: 'مستند ملاقات با کشاورز.',
  }, ['مستند', 'کشاورز']),
  mk(1195, 'Rural America Live', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'با تماشاگر', style: 'ترکیبی', effects: 'ترکیبی',
    layout: 'سنۀ اجرا', elements: 'استودیو، تماشاگر، روستا',
    materials: 'چوب، فلز، شیشه', colors: 'گرم، کرم، سبز',
    lighting: 'روشن', summary: 'مستند روستای آمریکا به‌صورت زنده.',
  }, ['مستند', 'زنده']),
  mk(1196, 'Farm to Fork', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه، کارخانه، سفر غذا',
    materials: 'فلز، چوب، پلاستیک', colors: 'سبز، قهوه‌ای، نقره‌ای',
    lighting: 'ترکیبی', summary: 'مستند از مزرعه تا چنگال.',
  }, ['مستند', 'غذا']),
  mk(1197, 'Homegrown', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'باغ خانگی، سبزیجات، خانواده',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قرمز، قهوه‌ای',
    lighting: 'خورشید طبیعی', summary: 'مستند خانگی رشد داده شده.',
  }, ['مستند', 'باغ']),
  mk(1198, 'Our Yorkshire Farm', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'مزرعه یورکشایر، خانواده، حیوانات',
    materials: 'چوب، فلز، خاک', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند مزرعه یورکشایر ما.',
  }, ['مستند', 'یورکشایر']),
  mk(1199, 'Alaska: The Last Frontier', CAT.rusta, {
    size: 'بزرگ/لوکس', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'آلاسکا، مرز نهایی، خانواده',
    materials: 'چوب، فلز، پارچه', colors: 'سفید، سبز، قهوه‌ای',
    lighting: 'خورشید طبیعی', summary: 'مستند آلاسکا: مرز نهایی.',
  }, ['مستند', 'آلاسکا']),
  mk(1200, 'The Highland Vet', CAT.rusta, {
    size: 'متوسط/استاندارد', viewers: 'بدون تماشاگر', style: 'ترکیبی', effects: 'فیزیکی/واقعی',
    layout: 'موقعیت‌محور', elements: 'دامپزشک، کوهستان، حیوانات',
    materials: 'چوب، فلز، پلاستیک', colors: 'سبز، قهوه‌ای، آبی',
    lighting: 'خورشید طبیعی', summary: 'مستند دامپزشک هایلند.',
  }, ['مستند', 'دامپزشک']),
];

export { rustaShows };
