import { Database } from 'bun:sqlite';
const db = new Database('/home/z/my-project/mini-services/api-service/bankresaneh.sqlite', { readonly: true });
const rows = db.prepare("SELECT num, name, category, tags FROM shows ORDER BY num").all() as any[];

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const dbNames = rows.map(r => ({ num: r.num, name: r.name, category: r.category, tags: r.tags }));
const dbNorm = new Map<string, number>();
const dbWords = new Map<string, Set<number>>();
for (const r of dbNames) {
  const n = norm(r.name);
  if (n) dbNorm.set(n, r.num);
  for (const w of n.split(' ')) {
    if (w.length < 2) continue;
    if (!dbWords.has(w)) dbWords.set(w, new Set());
    dbWords.get(w)!.add(r.num);
  }
}

function cleanTitle(t: string): string {
  let s = t.trim();
  s = s.replace(/^[\d۰-۹]+\s*[.\-–)]?\s*/, '');
  s = s.replace(/^[^\p{L}\p{N}]+/u, '');
  s = s.replace(/^["'«»]+|["'«»]+$/g, '');
  return s.trim();
}

function findMatch(title: string): number | null {
  const c = cleanTitle(title);
  if (!c) return null;
  const n = norm(c);
  if (!n) return null;
  if (dbNorm.has(n)) return dbNorm.get(n)!;
  const mainPart = c.split(/\s+[—–-]\s+/)[0].trim();
  const mainNorm = norm(mainPart);
  if (mainNorm && dbNorm.has(mainNorm)) return dbNorm.get(mainNorm)!;
  // English-stopwords to avoid false positives like "The Edge" / "Inside the Boys"
  const STOP = new Set(['the','and','with','show','shows','a','an','of','to','in','on','for','at','by','from','is','it','this','that','die','der','das','el','la','los','las','le','les','un','une','des','di','da','du','il','la','lo','al','en','y','o','e','i','a','de','del','della','della','inside','late','night','day','live','story','world','life','man','war','spy','spies','game','secret','secrets','true','real','time','full','part','series','documentary','special','episode','ep','s01','s02','e01','e02','history','american','british','cold','agent','agents']);
  const engMatch = c.match(/[A-Za-z][A-Za-z0-9 .,'’:&\-–()&!]+/);
  if (engMatch) {
    const eng = norm(engMatch[0]);
    if (eng && dbNorm.has(eng)) return dbNorm.get(eng)!;
    // Only accept a word-overlap match if EVERY significant english word (len>=4, not stopword) is present
    const engWords = eng.split(' ').filter(w => w.length >= 4 && !STOP.has(w));
    if (engWords.length >= 2) {
      for (const r of dbNames) {
        const rn = norm(r.name);
        if (!rn) continue;
        const rwords = new Set(rn.split(' '));
        let allPresent = true;
        for (const w of engWords) if (!rwords.has(w)) { allPresent = false; break; }
        if (allPresent) return r.num;
      }
    }
  }
  return null;
}

type Entry = { title: string; section?: string };
type Group = { pdf: string; nameFa: string; entries: Entry[] };
const groups: Group[] = [];

groups.push({ pdf: 'sarfjooyi.pdf', nameFa: '۱. صرفه‌جویی', entries: [
  { title: 'Save Your Energy' }, { title: 'The Great Big Energy Saving Challenge' },
  { title: 'Power to the Pococks: A Year in the Life of a Crofting Family' },
  { title: 'Eco House Challenge' }, { title: 'PowerHouse TV' }, { title: 'Living with Ed' },
  { title: 'Wa$ted' }, { title: 'Green Builders' }, { title: 'Race to Save Water' },
  { title: 'Energy Switch' }, { title: 'The Rain We Keep' }, { title: 'The Water Brothers' },
  { title: 'Building Green' },
]});

groups.push({ pdf: 'kasht-darakht.pdf', nameFa: '۲. کاشت درخت', entries: [
  { title: 'Greening Nevada / Green Up' }, { title: 'The Secret Life of Trees' },
  { title: 'This Is Emily Yeung' }, { title: 'The Secret Life of Trees' }, { title: 'Roots' },
  { title: 'Roots of Life' }, { title: 'Growing a Greener World' }, { title: 'Gardening by the Yard' },
  { title: 'Green Fingers' }, { title: "Gardeners' World" }, { title: 'Garden Smart' },
  { title: 'The Modern Gardener' }, { title: 'Great British Garden Revival' },
  { title: 'The Edible Garden' }, { title: 'Real Gardens' }, { title: 'Gardening with Carol Klein' },
  { title: 'The Family Plot: Gardening' }, { title: 'Virginia Home Grown' },
  { title: 'Gardening Australia' }, { title: 'The Great Garden Revolution' }, { title: 'Recreating Eden' },
]});

groups.push({ pdf: 'krismas.pdf', nameFa: '۳. کریسمس', entries: [
  { title: 'Carols by Candlelight' }, { title: 'Christmas in Hospitals' },
  { title: 'Disney Parks Christmas Day Parade' }, { title: 'Sinterklaas News' },
  { title: 'Late Night Toy Show' }, { title: 'Spanish Christmas Lottery' },
  { title: 'Donald Duck and Friends Wish You a Merry Christmas' }, { title: 'Novena de Aguinaldos' },
  { title: 'After the Rain: A Christmas of Hope' }, { title: "Dick Clark's New Year's Rockin' Eve" },
  { title: 'Roberto Carlos Special' }, { title: "The National Lottery's New Year's Eve Big Bash" },
  { title: "Ant & Dec's Christmas Show" }, { title: "New Year's Eve and Christmas Eve Big Show" },
  { title: 'Die Silvester Show' },
]});

groups.push({ pdf: 'polisi.pdf', nameFa: '۴. پلیسی', entries: [
  { title: 'پرونده‌های پزشکی قانونی', section: 'مستندهای پلیسی ـ تحقیقی' },
  { title: '۴۸ ساعت اول', section: 'مستندهای پلیسی ـ تحقیقی' },
  { title: 'زندان لاس‌وگاس', section: 'مستندهای پلیسی ـ تحقیقی' },
  { title: 'معماهای حل‌نشده با دنیس فارینا', section: 'مستندهای پلیسی ـ تحقیقی' },
  { title: 'تشکیلات قضایی کاجون', section: 'مستندهای پلیسی ـ تحقیقی' },
  { title: 'رهگیری‌های پلیس', section: 'مستندهای پلیسی ـ تحقیقی' },
  { title: 'پلیس به‌صورت زنده تقدیم می‌کند: دوربین دپارتمان پلیس', section: 'رئالیتی‌شوهای فعالیت‌های پلیسی' },
  { title: 'ایست پلیس!', section: 'رئالیتی‌شوهای فعالیت‌های پلیسی' },
  { title: 'نیروهای پشت خط', section: 'رئالیتی‌شوهای فعالیت‌های پلیسی' },
  { title: 'پلیس‌های ساحلی', section: 'رئالیتی‌شوهای فعالیت‌های پلیسی' },
  { title: 'جنگ‌های جاده‌ای', section: 'رئالیتی‌شوهای فعالیت‌های پلیسی' },
  { title: 'گشت بزرگراه', section: 'رئالیتی‌شوهای فعالیت‌های پلیسی' },
  { title: 'افسران پلیس زن در دالاس', section: 'رئالیتی‌شوهای پلیسی ـ خانوادگی' },
  { title: 'کارآگاه واقعی', section: 'رئالیتی‌شوهای پلیسی ـ خانوادگی' },
  { title: 'عملیات قاچاق حیوانات', section: 'مستندهای پلیسی ـ محیط زیستی' },
  { title: 'عدالت وحشی', section: 'مستندهای پلیسی ـ محیط زیستی' },
  { title: 'پلیس‌های گُلد کوست', section: 'مستندهای پلیسی ـ فناوری' },
  { title: 'از دریچه لنز آبی‌رنگی', section: 'مستندهای پلیسی ـ اجتماعی' },
  { title: 'آکادمی پلیس بریتانیا', section: 'مستندهای پلیسی ـ بین‌المللی' },
]});

groups.push({ pdf: 'ramazan.pdf', nameFa: '۵. رمضان', entries: [
  { title: 'سفر زیارتی', section: 'سفر زیارتی و خودشناسی' },
  { title: 'سفری در جستجوی خویشتن — Pilgrimage', section: 'سفر زیارتی و خودشناسی' },
  { title: 'انذار', section: 'انذار و اصلاح رفتار' },
  { title: 'کمپ برات — Brat Camp', section: 'انذار و اصلاح رفتار' },
  { title: 'بچه‌های بد — Bad Lads', section: 'انذار و اصلاح رفتار' },
  { title: 'فراتر از ترس صریح — Beyond Scared Straight', section: 'انذار و اصلاح رفتار' },
  { title: 'مسابقه برای صرفه‌جویی در آب — Race to Save Water', section: 'کار خیر' },
  { title: 'تیم ما را با دیوید بکهام نجات دهید — Save Our Squad with David Beckham', section: 'کار خیر' },
  { title: 'اعضای بدن — Body Parts', section: 'کار خیر' },
  { title: 'DIY SOS', section: 'کار خیر' },
  { title: 'اهداکننده — Giver', section: 'کار خیر' },
  { title: 'دوستان قهوه — Coffee Friends', section: 'کار خیر' },
  { title: 'عشق بعد از زندان — Love After Lockup', section: 'توبه و تغییر زندگی' },
  { title: 'عادات بد، نظم مقدس — Bad Habits, Holy Orders', section: 'توبه و تغییر زندگی' },
  { title: '۱۹ کودک و بیشتر — 19 Kids and Counting', section: 'خانواده' },
  { title: 'من را ببر پیش مادرت — Take Me to Your Mother', section: 'خانواده' },
  { title: 'بابا! کجا می‌رویم؟ — Dad! Where Are We Going?', section: 'خانواده' },
  { title: 'داستان خدا با مورگان فریمن — The Story of God with Morgan Freeman', section: 'مذهبی' },
  { title: 'Three Meals a Day', section: 'آشپزی' },
  { title: 'مسابقات دونات‌پزی — Donut Showdown', section: 'آشپزی' },
  { title: 'برنامه اف‌ام قبل از افطار — Pas Buka FM', section: 'اندونزی' },
  { title: 'سحرها با گاس مفتاح — Sahur Bersama Gus Miftah', section: 'اندونزی' },
  { title: 'غرفه ماه رمضان — Warung Ramadan', section: 'اندونزی' },
  { title: 'اندونزی آرام من — Damai Indonesiaku', section: 'اندونزی' },
  { title: 'آواها و نواهای رمضان — Syiar Syair Ramadhan', section: 'اندونزی' },
  { title: 'ماه رمضان پر از برکت است — Ramadan Itu Berkah', section: 'اندونزی' },
  { title: 'آثار قرآن — Jejak Al Quran', section: 'اندونزی' },
  { title: 'کوبیدن بر در دل — Mengetuk Pintu Hati', section: 'اندونزی' },
  { title: 'شهاب و شهاب — Shihab & Shihab', section: 'اندونزی' },
  { title: 'بیا سحری بخوریم — Yuk Kita Sahur', section: 'اندونزی' },
  { title: 'مامان و آ.آ. در عمل — Mama & AA Beraksi', section: 'اندونزی' },
  { title: 'وقت سحری خوردن است — Saatnya Kita Sahur', section: 'اندونزی' },
  { title: 'آکادمی سحر اندونزی — Akademi Sahur Indonesia', section: 'اندونزی' },
  { title: 'حافظ اندونزی — Hafiz Indonesia', section: 'اندونزی' },
  { title: 'قدمگاه پیامبران — Jejak Rasul', section: 'مالزی' },
  { title: 'از استاد بپرس — Tanyalah Ustaz', section: 'مالزی' },
  { title: 'سحری با کمپاس — Kompas Sahur', section: 'مالزی' },
  { title: 'علمای نوسانتارا — Ulama Nusantara', section: 'مالزی' },
  { title: 'رمضان و مردم — رمضان والناس', section: 'قطر' },
  { title: 'سفر ما — سفرتنا', section: 'قطر' },
  { title: 'حروف نور — حروف من نور', section: 'قطر' },
  { title: 'پیامبر یک الگو است — الرسول قدوة', section: 'قطر' },
  { title: 'خانواده ما در ماه رمضان — عيالنا في رمضان', section: 'قطر' },
  { title: 'سحری — الغبقة', section: 'قطر' },
  { title: 'سفر نیکوکاری — سفاري الخير', section: 'قطر' },
  { title: 'شب‌های رمضان — ليالي رمضان', section: 'قطر' },
  { title: 'پیمان — سند', section: 'قطر' },
  { title: 'فضائل ماه مبارک رمضان — فضائل رمضانية', section: 'قطر' },
  { title: 'دین ما — ديننا', section: 'قطر' },
  { title: 'آوای ورود ماه رمضان — الواردة', section: 'قطر' },
  { title: 'سلام بر رمضان — أهلاً رمضان', section: 'قطر' },
  { title: 'غذاهای رمضان — أكلات رمضانية', section: 'قطر' },
  { title: 'نیکوکاری‌های جامعه‌محور — خير أهلي', section: 'قطر' },
  { title: 'بهترین سفر — أحلى رحلة', section: 'قطر' },
  { title: 'قواعد قرآنی — قواعد قرآنية', section: 'قطر' },
  { title: 'مسجدالاقصی — مسرى', section: 'قطر' },
  { title: 'آن را بشناس — تعرّف عليه', section: 'قطر' },
  { title: 'محفل رمضان — صحبة رمضان', section: 'قطر' },
  { title: 'نور و نشانه‌ها — نور وأعلام', section: 'قطر' },
  { title: 'جام‌های رمضان — دورات رمضانية', section: 'قطر' },
  { title: 'سلامتی ما در ماه رمضان — صحتنا في رمضان', section: 'قطر' },
  { title: 'کلمه مهربانی — الكلمة الطيبة', section: 'قطر' },
  { title: 'با قرآن هدایت شدم — بالقرآن اهتديت', section: 'قطر' },
]});

groups.push({ pdf: 'safar-jadeh.pdf', nameFa: '۶. سفر جاده‌ای', entries: [
  'Below Deck','Man vs. Wild','Race Across the World','An Idiot Abroad','The Amazing Race',
  'Jack Whitehall: Travels with My Father','Expedition Unknown','Ice Road Truckers','Instant Hotel',
  'Long Way Down','American Pickers','Dark Tourist','The Grand Tour','Destination Fear','Extreme Engagement',
  'Somebody Feed Phil','Gordon, Gino and Fred: Road Trip','Anthony Bourdain: Parts Unknown','Men in Kilts: A Roadtrip with Sam and Graham',
  "Rick Steves' Europe",'Globe Trekker','The Moaning of Life','Long Way Up','Ugly Delicious','Bizarre Foods with Andrew Zimmern',
  "Gordon's Great Escape",'Top Gear','Breakfast, Lunch & Dinner','Travel Guides','Amazing Hotels: Life Beyond the Lobby',
  "Diners, Drive-ins and Dives","The World's Most Amazing Vacation Rentals","James May: Our Man in...","Stephen Fry in America",
  'The Reluctant Traveler',"Chef's Table",'Below Deck Mediterranean',"Stanley Tucci: Searching for Italy",'Restaurants on the Edge',
  'Anthony Bourdain: The Layover','Gordon Ramsay: Uncharted','Follow Alana','Man v. Food','101 Places To Party Before You Die',
  "Charley Boorman: Ireland to Sydney by Any Means",'Below Deck Down Under','Anthony Bourdain: No Reservations',
  'Down to Earth with Zac Efron','Running Wild with Bear Grylls',"The World's Most Extraordinary Homes",
  "Trippin' with Anthony Anderson and Mama Doris",'You vs. Wild','Dhani Tackles the Globe','Carnival Eats','Departures',
  'Best in Chow','Street Food','Never Say Never with Jeff Jenkins','Salt Fat Acid Heat','Taste the Nation','Gaycation',
  'Fresh, Fried & Crispy','The Thirsty Traveler','Running Wild With Bear Grylls: The Challenge','Twogether',
  'Midnight Asia: Eat Dance Dream','The Hungry and the Hairy','The Travel Show','Curious Traveler','Dream of Italy',
  'Travels with Darley',"I'll Have What Phil's Having",'Travel with Kids',"Samantha Brown's Places to Love",'Travelscope',
  'Sacred Journeys with Bruce Feiler','Fly Brother with Ernest White II','Antiques Roadshow','Ireland with Michael',
  'Bare Feet with Mickela Mallozzi','Beyond Your Backyard','Burt Wolf: Travels and Traditions',
  'Canvasing the World with Sean Diediker','Equitrekking','Expedition with Steve Backshall','Wonders of Mexico',
  'Family Travel With Colleen Kelly','La Frontera with Pati Jinich','Miriam and Alan: Lost in Scotland',
  'The Great Muslim American Road Trip','Smart Travels with Rudy Maxa','Travel Man','The Kindness Diaries',
].map(t => ({ title: t }))});

groups.push({ pdf: 'madrese.pdf', nameFa: '۷. مدرسه', entries: [
  { title: 'Welcome Back to School' },
  { title: 'Essential Apps and Tech for a Successful Back-to-School Season' },
  { title: 'تجهیزات الکترونیکی شرکت وریزون برای سال تحصیلی جدید' },
  { title: 'ایده‌های ابزارهای الکترونیکی برای بازگشت به مدرسه برای دانش‌آموزان دوره راهنمایی و دبیرستان' },
  { title: 'این اپلیکیشن‌ها را برای شروع سال تحصیلی جدید امتحان کنید' },
  { title: 'راهنمای تکنولوژی برای شروع سال تحصیلی جدید' },
  { title: 'بهترین فناوری برای کمک به بچه‌های شما در این سال تحصیلی' },
  { title: 'Chemistry Kit' },
  { title: 'برنامه مربوط به لوازم و فناوری بازگشت به مدرسه' },
  { title: 'نکات ایمنی بازگشت به مدرسه' },
  { title: 'برنامه‌ریزی برای بازگشت به مدرسه' },
  { title: 'بهبود آداب و رفتارهای بازگشت به مدرسه' },
  { title: 'برنامه‌های مربوط به نحوه بازگشت به مدرسه' },
  { title: 'چگونگی پس‌انداز و کسب درآمد برای هزینه‌های بالای بازگشت به مدرسه' },
  { title: 'صرفه‌جویی در خرید لوازم مدرسه' },
  { title: 'بازگشت به مدرسه بدون هزینه زیاد' },
  { title: 'بازگشت به مدرسه: چگونه در خرید مواد غذایی برای مدرسه صرفه‌جویی کنیم' },
  { title: 'چگونه زباله را کاهش دهیم' },
  { title: 'شرکت وریزون: کودکان را برای موفقیت در بازگشت به مدرسه توانمند می‌کند' },
  { title: 'Woolly and Tig' },
  { title: 'تیزر بازگشت به مدرسه' },
  { title: 'صحبت‌های مدیرکل آموزش' },
  { title: 'کلیپ تولیدشده توسط دانش‌آموزان' },
  { title: 'بهترین برنامه‌ها و فناوری‌های بازگشت به مدرسه' },
  { title: 'سؤالات بچه‌ها' },
  { title: 'مناظره خبری درباره بازگشایی مدارس دخترانه در افغانستان' },
  { title: 'کلیپ بازگشت به مدرسه از واحد آموزش شبکه PBS' },
]});

groups.push({ pdf: 'naghd-film.pdf', nameFa: '۸. نقد فیلم', entries: [
  { title: 'Spoilers with Kevin Smith' }, { title: "Vice Magazine's Film & TV" },
  { title: 'Movie Club with John Ridley' }, { title: 'At the Movies' }, { title: 'Rotten Tomatoes' },
  { title: 'Screen Junkies' }, { title: 'Full Frontal with Samantha Bee' }, { title: 'The IMDb Show' },
  { title: 'The Movies That Made Us' }, { title: 'Double Toasted' }, { title: 'Film Threat' },
  { title: 'Film Comment' },
]});

groups.push({ pdf: 'ghanun-asasi.pdf', nameFa: '۹. قانون اساسی', entries: [
  { title: 'Constitution USA with Peter Sagal' }, { title: 'The Constitution Project' },
  { title: 'The Canadian Constitution' }, { title: 'We the People with Nina Totenberg' },
  { title: 'The Japanese Constitution' }, { title: 'The German Constitution: Basic Law' },
  { title: 'La Constitution en question' }, { title: 'The South African Constitution' },
  { title: 'The Australian Constitution' },
]});

groups.push({ pdf: 'pakhsh-zende.pdf', nameFa: '۱۰. پخش زنده', entries: [
  { title: 'Lake Shore Railway Museum- East Camera', section: 'ایستگاهای قطار و مسیر های ریلی' },
  { title: 'Livestream RailCam Netherlands', section: 'ایستگاهای قطار و مسیر های ریلی' },
  { title: 'Mount Washington Cog Railway live Webcam', section: 'ایستگاهای قطار و مسیر های ریلی' },
  { title: 'HECK NEWS - Nanaimo harbour Cam 24-7 LiveStream', section: 'خیابان ها و معابر شهری' },
  { title: 'Come Back Real Time LIVE Walking tour Seoul Korea - Hong Kong', section: 'خیابان ها و معابر شهری' },
  { title: "Live Duval street, Key West, Florida - Outside sloppy Joe's", section: 'خیابان ها و معابر شهری' },
  { title: 'London Bus Rides', section: 'خیابان ها و معابر شهری' },
  { title: 'NOW Shibuya Scramble Crossing Tokyo- Japan', section: 'خیابان ها و معابر شهری' },
  { title: 'Philippines live street view camera - Market area', section: 'خیابان ها و معابر شهری' },
  { title: 'Ukraine Live Coverage 24/7', section: 'خیابان ها و معابر شهری' },
  { title: 'Live Stream 4K - Digital.Tallinn City Cam -Estonia 24/7', section: 'خیابان ها و معابر شهری' },
  { title: 'LIVE - NASA Livestream of Earth from Space (ISS)', section: 'تصاویر ماهواره ای' },
  { title: 'Live Moon Watch', section: 'تصاویر ماهواره ای' },
  { title: 'Iceland Volcano Eruption', section: 'حیات وحش، پارک ملی و باغ وحش ها' },
  { title: 'Brooks Falls- Katmai national park- Alaska 2023', section: 'حیات وحش، پارک ملی و باغ وحش ها' },
  { title: 'Live Birds in 4K! Cornell lab Feederwatch cam at sabsucker woods', section: 'حیات وحش، پارک ملی و باغ وحش ها' },
  { title: 'Namibia - Live stream in the Namib desert', section: 'حیات وحش، پارک ملی و باغ وحش ها' },
  { title: 'Ol Donyo lodge LIVE- Africam wildlife stream – Kenya', section: 'حیات وحش، پارک ملی و باغ وحش ها' },
  { title: 'Poole Harbour Osprey Nest Camera - Landscape view', section: 'حیات وحش، پارک ملی و باغ وحش ها' },
  { title: 'Relaxing Music To Relieve Stress, Anxiety and Depression . Mind, Body, Soothing Music for nerves', section: 'حیات وحش، پارک ملی و باغ وحش ها' },
  { title: 'Tau game lodge LIVE- Africam wildlife stream – Madikwe', section: 'حیات وحش، پارک ملی و باغ وحش ها' },
  { title: 'Wolong Grove Panda Cam - Powered by EXPLORE.org', section: 'حیات وحش، پارک ملی و باغ وحش ها' },
  { title: 'Lake hood Seaplane Base - Anchorage , Alaska, USA', section: 'فرودگاه ها' },
  { title: 'Live Webcam from Lanzarote Airport - Canary Islands –Spain', section: 'فرودگاه ها' },
  { title: 'Prague Airport LIVE - CZECH Republic', section: 'فرودگاه ها' },
]});

const spyList = `Surveillance Secrets
Spycraft
Citizenfour
Spy Ops
The Spy
Spymasters: CIA in the Crosshairs
Secret Agent Selection: WW2
Tales From the Cold War The Mole:
Undercover in North Korea
Spies of War Declassified:
Untold Stories of American Spies
A Cold War of Spies
Mata Hari: The Naked Spy
Inside the Mossad
Shadow OPS Kim Philby: His
Most Intimate Betrayal
The Spy Who Went Into the Cold
Queen Elizabeth's Secret Agents
Spy Capital
Third Eye Spies
Execution: A Granddaughter's Story Cold War Secrets: Stealing the Atomic
Bomb Original title: Deux bombes pour une espionne
Traitor/Patriot American
Conspiracy: The Octopus Murders The Great Game
Original title: Fædre og sønner
The Spy Behind Home Plate
Original title: Eli Cohen: Lochem 566 Double Cross: The
True Story of the D-day Spies
SpyTek
Castro's Spies
Az elíziumi kém
El Crazy Che
Sylvia: Tracing Blood
Blind Man's Bluff
Original title: Meragel Ha- Shampaniya
The Mossad: Imperfect Spies
The Impossible Spy
Chichinette: The Accidental Spy
The Spy Who Fell to Earth
The Green Prince
Agents Unknown
Pollard
Rich Hall's Red Menace
Gehlen: Hitler's Superspy Stalin's James Bond
Original title: Richard Sorge - Ein Romantiker als Spion
Traitors Within
Infiltratören
ApolloniA
Modern Spies
A Trial in Prague
Spying on the Royals The Island of Spies
Original title: To nisi ton kataskopon
The Secret Life of Uri Geller Erittäin salainen –
Vakoilua Suomessa
The Trials of Alger Hiss
Churchill's Spy School Weapons of War: Air Power & Missiles - Special
Forces: Skills in Combat - Spies: The Dirty Game of Espionage Landmark
American Trials: Julius and Ethel Rosenberg
Original title: Bylem generalem Wehrmachtu
Tracking Edith Spies: The Dirty
Game of Espionage
Top Secret Missions of the CIA
SpyGames
Udi Adiv. Daud Turki
Kidnapped!
Secrets of the Spy Whale
Mata Hari: The Beautiful Spy
Stingray
Damian Lewis: Spy Wars
Secrets & Spies: A Nuclear Game
Secrets, Lies, and Atomic Spies
Secrets of the Spies
A Compassionate Spy
Enemies of the State
Original title: Garbo: El espía
David Jason's Secret Service
The Man Nobody Knew My Father the Spy
Original title: Spiegs, kurs mans tevs
the Wych-Elm?: The Untold Secrets
Rino: The Spy Story Spy Nation
Original title: Ja- baek The Unquiet Death
of Julius & Ethel Rosenberg
Out of Dark United States of
Scandal with Jake Tapper
Riding with a Spy
Klaus Fuchs - Atomspion
Spymaster
Spies of Mississippi
A Spy in the FBI
Disinformation
Der Mann ohne Gesicht War Games and
the Man Who Stopped Them
Tania - La Guerrillera
Intelligence in WWII
The Spy Among Us/Li Na
Confessions of an IRA Informer
The Spy in the IRA Richard Sorge. Feat scout
Original title: Rikhard Zorge. Podvig razvedchika
Traitors: The Extraordinary Life of Guy Burgess
A Spy's Life: Kitty Harris
Zhenshchina pod grifom 'sekretno'
The Hunt for Atomic Secrets
Secrets of War
The Spy Who Stole the Atom Bomb Codename Lucy:
Spies Against Nazis
polkovnika Rybkinoy
Letters from Baghdad Enemy of the
Reich: The Noor Inayat Khan Story
Halina Szymanska How Israeli technology became
one of the world's most feared spyware | Al Jazeera World
Today's intelligence agencies
Majesty's Secret Service Spies in America who stole and sold
U.S. secrets ی برنامه از قسمت یک 60 minutes
Double Agent: Inside Al Qaeda Edward Snowden:
Spies and the Law
activities in Turkey | Al Jazeera World Documentary She Zhijiang: Discarded Chinese
spy or criminal mastermind? | 101 East Documentary
spying operations in Australia revealed
Agent 88 | Al Jazeera World Spies Next Door: Operation Ghost
Stories - Declassified - S01 EP02 - Documentary
security vs the public's right to know
Shula Cohen | Al Jazeera World
Death of a Superspy | Al Jazeera World
Spy Who Took On the West | True Life Spy Stories
Spies of War - The A-Bomb Spies
Valuable Spy | True Life Spy Stories
WW2 - The Limping Lady | True Life Spy Stories Declassified Spy Stories - Cuba:
Traitor on the Inside | History Documentary | Reel Truth History
Greatest Spy | True Life Spy Stories Wilhelm Canaris:
Hitler's Spy Master Who Turned Against Him Declassified Spy
Stories - Hexagon: The Secret Satellite
Spy Documentary برنامه از قسمتی Arts Unveiled The Rise and Fall of a Spy Master –
Treason: Codes, Spies and Conspiracies S01 E01
Missions In Occupied France | A Most Secret Service | Timeline Pine Gap, the Cold War; when spies
put Australia in nuclear crosshairs | Spies in the Outback Ep2
dangerous spy in history | True Life Spy Stories
Man Inside MI6 | True Life Spy Stories The Most Damaging Soviet
Spy Ring in American History | True Life Spy Stories
sold secrets to Russia | Four Corners Double Cross The
True Story of the D-Day Spies How the Mossad
Assassinated Iran's Top Nuclear Scientist
Spies and Secrets of the Cold War The Cold War Spy
Who Disappeared | True Life Spy Stories
Tooth: Inside the World of Espionage The British Agent
Who Became A KGB Spy | Comrade Philby
Who Got Away | True Life Spy Stories Spies of War - The
Spy who Saved the World | Full Documentary
Valuable Spy in America | True Life Spy Stories
Navy's Most Prolific Spy | True Life Spy Stories
The Spy Inside
Espionage and Intrigue | The Sword and the Shield Ep.2 How Intelligence
agencies catch criminals
Marwan | The World's Greatest Spy Or Double Agent? Putin's fleet -
Russian espionage in the Baltic Sea`.split('\n').map(l => l.trim()).filter(Boolean).map(t => ({ title: t }));

groups.push({ pdf: 'spy-column5', nameFa: '۱۱. ستون پنجم (جاسوسی)', entries: spyList });

let totalChecked = 0, totalFound = 0, totalMissing = 0;
const report: string[] = [];

for (const g of groups) {
  let found = 0;
  const missing: Entry[] = [];
  const foundList: { title: string; num: number }[] = [];
  for (const e of g.entries) {
    totalChecked++;
    const m = findMatch(e.title);
    if (m !== null) { found++; totalFound++; foundList.push({ title: e.title, num: m }); }
    else { missing.push(e); totalMissing++; }
  }
  report.push('');
  report.push('═══════════════════════════════════════════════════════');
  report.push(`📁 ${g.nameFa}  (${g.pdf})`);
  report.push(`   کل: ${g.entries.length}  |  موجود: ${found}  |  ناموجود: ${missing.length}`);
  report.push('═══════════════════════════════════════════════════════');
  if (missing.length > 0) {
    report.push('   ❌ برنامه‌های ناموجود:');
    missing.forEach((e, i) => {
      report.push(`      ${i + 1}. ${e.title}${e.section ? '  [بخش: ' + e.section + ']' : ''}`);
    });
  }
  if (foundList.length > 0) {
    report.push('   ✅ برنامه‌های موجود:');
    foundList.forEach(f => { report.push(`      • ${f.title}  →  شماره ${f.num}`); });
  }
}

report.push('');
report.push('╔═══════════════════════════════════════════════════════╗');
report.push('║                    خلاصه کلی                          ║');
report.push('╠═══════════════════════════════════════════════════════╣');
report.push(`║  کل برنامه‌های بررسی‌شده: ${totalChecked}`);
report.push(`║  موجود در دیتابیس:       ${totalFound}`);
report.push(`║  ناموجود (ندارم):       ${totalMissing}`);
report.push('╚═══════════════════════════════════════════════════════╝');

await Bun.write('/home/z/my-project/comparison_report.txt', report.join('\n'));
console.log(report.join('\n'));
db.close();
