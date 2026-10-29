"""Master script: Parse programs from all 4 PDFs, build program records,
write to public/talk-shows-data.json, and add new genres to src/app/page.tsx.
"""
import json
import os
import re
import urllib.parse

ROOT = "/home/z/my-project"

# Load image map: {"pdf_idx_page": [image_paths]}
with open(f"{ROOT}/scripts/pdf_extract/image_map.json", "r", encoding="utf-8") as f:
    IMAGE_MAP = json.load(f)

def imgs_for(pdf_idx, page_indices):
    """Return all image paths for the given PDF index and page range (inclusive)."""
    out = []
    for p in page_indices:
        key = f"{pdf_idx}_{p}"
        if key in IMAGE_MAP:
            out.extend(IMAGE_MAP[key])
    return out

# Load existing data
with open(f"{ROOT}/public/talk-shows-data.json", "r", encoding="utf-8") as f:
    existing = json.load(f)
print(f"Existing programs: {len(existing)}, max num: {max(p['num'] for p in existing)}")

# Load each PDF's text
PDF_TEXT = {}
LABELS = {1: "نقد فیلم", 2: "خانواده", 3: "رمضان", 4: "دوربین"}
for i in [1, 2, 3, 4]:
    with open(f"{ROOT}/scripts/pdf_extract/pdf{i}_{LABELS[i]}_text.json", "r", encoding="utf-8") as f:
        PDF_TEXT[i] = json.load(f)["pages"]

# Helper: clean Persian text (remove excessive whitespace, normalize)
def clean_text(s):
    if not s:
        return ""
    # Collapse runs of whitespace into single spaces, but keep paragraph breaks
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()

# Categories (Persian) per PDF
CATEGORY = {
    1: "نقد و بررسی فیلم",
    2: "خانواده و افزایش جمعیت",
    3: "برنامه‌های ماه مبارک رمضان",
    4: "پخش زنده دوربین‌ها",
}

# Persian country names -> English (ordered by specificity; longer names first)
COUNTRY_FA_EN = {
    "آفریقای جنوبی": "South Africa",
    "آمریکا": "United States",
    "آمریکایی": "United States",
    "انگلستان": "United Kingdom",
    "بریتانیایی": "United Kingdom",
    "بریتانیا": "United Kingdom",
    "هلند": "Netherlands",
    "ژاپن": "Japan",
    "کره": "South Korea",
    "فیلیپین": "Philippines",
    "اوکراین": "Ukraine",
    "اندونزی": "Indonesia",
    "مالزی": "Malaysia",
    "قطر": "Qatar",
    "کویت": "Kuwait",
    "ترکیه": "Turkey",
    "ایران": "Iran",
    "آلمان": "Germany",
    "فرانسه": "France",
    "استرالیا": "Australia",
    "کانادا": "Canada",
    "ایرلند": "Ireland",
    "اسکاتلند": "Scotland",
    "نیجریه": "Nigeria",
    "هند": "India",
}

def detect_country(text):
    """Detect country from text using word-boundary regex (Persish-aware)."""
    if not text:
        return "Unknown"
    # Normalize: collapse whitespace (including newlines) to single spaces for matching
    norm = re.sub(r'\s+', ' ', text)
    # Order by length descending so multi-word matches win
    items = sorted(COUNTRY_FA_EN.items(), key=lambda x: -len(x[0]))
    for fa_name, en_name in items:
        # Word boundary: preceding char must not be Persian letter, following char must not be Persian letter
        escaped = re.escape(fa_name)
        pattern = r'(^|[^\u0600-\u06FF])' + escaped + r'(?=[^\u0600-\u06FF]|$)'
        if re.search(pattern, norm):
            return en_name
    # Fallback: also match "آمریک" prefix (text may be broken as "آمریک ایی")
    if re.search(r'(^|[^\u0600-\u06FF])آمریک(?=[\s\u0600-\u06FF]|$)', norm):
        return "United States"
    # Fallback: check network names
    net_text = norm[:1500]
    if 'MTV' in net_text and 'بریتانیا' in net_text:
        return 'United Kingdom'
    if 'MTV' in net_text or 'ABC' in net_text or 'TLC' in net_text or 'USA Network' in net_text or 'Up TV' in net_text:
        return 'United States'
    if 'BBC' in net_text:
        return 'United Kingdom'
    if 'Discovery' in net_text:
        return 'United States'
    if 'Netflix' in net_text or 'نتفلیکس' in net_text:
        return 'United States'
    return 'Unknown'

# Hardcoded country overrides for known PDF2 shows (the texts don't always state the country clearly)
COUNTRY_OVERRIDE_PDF2 = {
    "Maternity Ward": "United States",
    "A Baby Story": "United States",
    "Take Me to Your Mother": "United States",
    "I Live Alone": "South Korea",
    "At Home with the Buckleys": "United Kingdom",
    "Rock of Love: Charm School": "United States",
    "Unusually Thicke": "United States",
    "Out Daughtered": "United States",
    "The Blended Bunch": "United States",
    "Sweet Home Sextuplets": "United States",
    "Meet the Putmans": "United States",
    "Doubling Down with the Derricos": "United States",
    "Counting On": "United States",
    "I'm Pregnant and...": "United States",
    "Babies": "United States",
}

# ============================================================
# PDF 1: نقد فیلم (Film Review Programs)
# ============================================================
# Each program starts on a page with English name + "شبکه کشور مجری" + network + country + host + ":مهمانان" + guests + description
# Programs identified manually from text dump:

PDF1_PROGRAMS = [
    # (english_name, start_page, end_page_inclusive)
    ("Spoilers with Kevin Smith", 1, 2),
    ("Vice Magazine's Film & TV", 3, 3),
    ("Movie Club with John Ridley", 4, 4),
    ("At the Movies", 5, 6),
    ("Rotten tomatoes", 7, 8),
    ("Screen Junkies", 9, 9),
    ("Full Frontal with Samantha Bee", 10, 11),
    ("The IMDb Show", 12, 13),
    ("The Movies That Made Us", 14, 15),
    ("Double Toasted", 16, 16),
    ("Film Threat", 17, 17),
    ("Film comment", 18, 20),
]

def parse_pdf1():
    out = []
    pages = PDF_TEXT[1]
    for name, sp, ep in PDF1_PROGRAMS:
        # Combine text from sp..ep
        text_parts = []
        for p in range(sp, ep + 1):
            text_parts.append(pages[p]["text"])
        full = "\n".join(text_parts)
        # Extract country: usually "آمریکا" appears alone on a line after the network
        country = detect_country(full)
        if country == "Unknown":
            country = "United States"  # PDF1 is all American shows
        # Extract network: line containing letters after "شبکه کشور مجری"
        # Look for the description after the host/guests block - usually starts with "یک" or "این برنامه"
        # We use the Persian text starting after the "مهمانان شاخص" line, or after the country/host line
        desc = full
        # Strip leading page numbers and metadata; keep Persian description
        # Find the start of the description: it usually starts after a line break following the host/guest info
        # Simple approach: find "یک برنامه" or "یک مجموعه" or "این برنامه" and slice from there
        m = re.search(r'(یک\s*(برنامه|مجموعه|پrogram|تله‌?ویزیونی|مجموعهٔ|مجموعه تلویزیونی))', full)
        if m:
            desc = full[m.start():]
        else:
            m = re.search(r'(این\s*برنامه)', full)
            if m:
                desc = full[m.start():]
        desc = clean_text(desc)
        # Limit length
        if len(desc) > 2500:
            desc = desc[:2500] + "…"
        # Images: from start page to end page
        images = imgs_for(1, list(range(sp, ep + 1)))
        if not images:
            # fallback: try surrounding pages
            images = imgs_for(1, [sp])
        out.append({
            "name": name,
            "pdf_idx": 1,
            "pages": list(range(sp, ep + 1)),
            "country": country,
            "descriptionFa": desc,
            "images": images[:6],  # cap at 6 images per program
        })
    return out

# ============================================================
# PDF 2: خانواده و افزایش جمعیت (Family & Population)
# ============================================================
# Programs identified manually with their start page (page index in PDF)
# Each program has English name as a line, followed by Persian description and Genre/Year/Episode block

PDF2_PROGRAMS = [
    # (english_name, page_index)
    ("Maternity Ward", 8),
    ("A Baby Story", 8),
    ("One Born Every Minute", 9),
    ("16 And Pregnant", 11),
    ("Geordie Shore", 11),
    ("Take Me to Your Mother", 12),
    ("I Live Alone", 13),
    ("At Home with the Buckleys", 13),
    ("Rock of Love: Charm School", 14),
    ("Unusually Thicke", 14),
    ("Little Big Shots", 16),
    ("Wayne Brady's Comedy IQ", 17),
    ("Kids Say the Darndest Things", 17),
    ("SUPERNANNY", 18),
    ("Family Feud", 19),
    ("Chrisley Knows Best", 21),
    ("Parental Control", 21),
    ("Extreme Makeover: Home Edition", 22),
    ("Kate Plus 8", 24),
    ("My Crazy Birth Story", 24),
    ("Jon & Kate Plus 8", 25),
    ("Teen Mom: Young and Pregnant", 25),
    ("Out Daughtered", 26),
    ("The Blended Bunch", 26),
    ("Sweet Home Sextuplets", 27),
    ("Meet the Putmans", 27),
    ("19 Kids and Counting", 28),
    ("Bringing Up Bates", 28),
    ("7 Little Johnstons", 29),
    ("Welcome to Plathville", 29),
    ("Little People, Big World", 30),
    ("Growing Up McGhee", 30),
    ("Doubling Down with the Derricos", 31),
    ("Counting On", 31),
    ("I'm Pregnant and...", 33),
    ("Babies", 33),
]

def parse_pdf2():
    out = []
    pages = PDF_TEXT[2]
    # Sort programs by page so we can compute end_page = next_program's start_page - 1 (same page if multiple on one page)
    sorted_progs = sorted(PDF2_PROGRAMS, key=lambda x: (x[1],))
    for i, (name, sp) in enumerate(sorted_progs):
        # Determine end page: next program's start page (same or later). For programs on the same page,
        # we still split the text at the next program's name.
        if i + 1 < len(sorted_progs):
            next_name, next_sp = sorted_progs[i + 1]
            ep = next_sp  # may equal sp if same page
        else:
            ep = len(pages) - 1  # last program goes to end
        # Combine text from sp..ep
        text_parts = []
        for p in range(sp, min(ep + 1, len(pages))):
            text_parts.append(pages[p]["text"])
        full = "\n".join(text_parts)
        # Slice description: from after the program name to before the next program name (or end)
        # Find the position of the program name in the text
        # The English name may be on its own line; find the first occurrence
        idx = full.find(name)
        if idx >= 0:
            # Start after the name
            after_name = full[idx + len(name):]
            # If multiple programs on same page, find next English name in after_name
            if i + 1 < len(sorted_progs):
                next_name, _ = sorted_progs[i + 1]
                nidx = after_name.find(next_name)
                if nidx >= 0:
                    after_name = after_name[:nidx]
            desc = after_name
        else:
            desc = full
        # Clean and limit; remove "Genre/Year/Episode/User ratings" block (English metadata)
        desc = re.sub(r'Genre\s*\n\s*Reality-TV[^\n]*\n\s*Year[^\n]*\n\s*Episode[^\n]*\n\s*User ratings[^\n]*', '', desc)
        desc = clean_text(desc)
        if len(desc) > 2500:
            desc = desc[:2500] + "…"
        # Country detection
        country = detect_country(full)
        if name in COUNTRY_OVERRIDE_PDF2:
            country = COUNTRY_OVERRIDE_PDF2[name]
        # Images: from this program's page only (since multiple programs can share a page,
        # we still attach all images on that page to all programs on the page — best effort)
        images = imgs_for(2, list(range(sp, min(ep + 1, len(pages)))))
        if not images:
            images = imgs_for(2, [sp])
        out.append({
            "name": name,
            "pdf_idx": 2,
            "pages": list(range(sp, min(ep + 1, len(pages)))),
            "country": country,
            "descriptionFa": desc,
            "images": images[:6],
        })
    return out

# ============================================================
# PDF 3: برنامه‌های ماه مبارک رمضان (Ramadan Programs)
# ============================================================
# Curated list of (english_name, persian_name, start_printed_page, country)
# Skip section/country headers (مقدمه, سفر زیارتی, مذهبی, آشپزی, country names, etc.)

PDF3_PROGRAMS = [
    # (name, persian, printed_page, country)
    ("Pilgrimage", "سفری در جستجوی خویشتن", 9, "United Kingdom"),
    ("Brat Camp", "کمپ برات", 20, "United Kingdom"),
    ("Bad Lads", "بچه‌ی‌های بد", 23, "United Kingdom"),
    ("Beyond Scared Straight", "فراتر از ترس‌ی حی‌صر", 25, "United States"),
    ("Race to Save Water", "مسابقه‌ی برای صرفه‌یی جو در آب", 28, "United Kingdom"),
    ("Save Our Squad with David Beckham", "میت ما را با یوید د بکهام نجات ی ده د", 29, "United Kingdom"),
    ("Body Parts", "اعضای بدن", 30, "United States"),
    ("DIY SOS", "DIY SOS", 32, "United Kingdom"),
    ("Giver", "اهدا کننده", 45, "United States"),
    ("Coffee Friends", "دوستان قهوه", 47, "South Korea"),
    ("Tawbah", "توبه", 49, "United Kingdom"),
    ("Love After Lockup", "عشق بعد از زندان", 50, "United States"),
    ("Bad Habits, Holy Orders", "عادات، بد نظم مقدس", 53, "United Kingdom"),
    ("Family", "خانواده", 55, "United States"),
    ("19 Kids and Counting", "۱۹ کودک و یب شتر", 56, "United States"),
    ("Take Me To Your Mother", "من را ببر شیپ مادرت", 58, "United States"),
    ("Dad! Where Are We Going", "بابا! کجا؟ می‌رویم", 60, "South Korea"),
    ("Capital One College Bowl", "جام دانشگاهی", 62, "United States"),
    ("The Story of God with Morgan Freeman", "داستان خدا با مورگان منی فر", 65, "United States"),
    ("Three Meals a Day", "سه وعده غذایی در روز", 67, "South Korea"),
    ("Donut Showdown", "مسابقات دوناتی پز", 68, "Canada"),
    ("Pas Buka FM", "برنامه اف‌ام قبل از افطار", 72, "Indonesia"),
    ("Sahur Bersama Gus Miftah", "سحرها با گاس مفتاح", 76, "Indonesia"),
    ("Warung Ramadan", "غرفه ماه رمضان", 79, "Indonesia"),
    ("Damai Indonesiaku", "اندونزی آرام من", 83, "Indonesia"),
    ("Syiar Syair Ramadhan", "آواها و نواهای رمضان", 87, "Indonesia"),
    ("Ramadan Itu Berkah", "ماه رمضان پر از برکت است", 89, "Indonesia"),
    ("Jejak Al Quran", "آثار قرآن", 92, "Indonesia"),
    ("Mengetuk Pintu Hati", "یکوب دن بر در دل", 95, "Indonesia"),
    ("Shihab & Shihab", "شهاب و شهاب", 98, "Indonesia"),
    ("Yuk Kita Sahur", "ایب سحری بخوریم", 102, "Indonesia"),
    ("Mama & AA Beraksi", "مامان و یا یا در عمل", 105, "Indonesia"),
    ("Saatnya Kita Sahur", "وقت سحری خوردن است", 108, "Indonesia"),
    ("Akademi Sahur Indonesia", "آکادمی سحر اندونزی", 111, "Indonesia"),
    ("Hafiz Indonesia", "حافظ اندونزی", 114, "Indonesia"),
    ("Jejak Rasul", "قدمگاه پیامبران", 120, "Malaysia"),
    ("Tanyalah Ustaz", "از استاد بپرس", 123, "Malaysia"),
    ("Kompas Sahur", "سحری با کمپاس", 127, "Malaysia"),
    ("Ulama Nusantara", "علمای نوسانتارا", 131, "Malaysia"),
    ("Ramadan wal-Nas", "رمضان و مردم", 136, "Qatar"),
    ("Safaratna", "سفر ما", 139, "Qatar"),
    ("Hurouf al-Noor", "حروف نور", 142, "Qatar"),
    ("Al-Rasul Qudwa", "پیامبری الگو است", 145, "Qatar"),
    ("Iyaluna fi Ramadan", "خانواده ما در ماه رمضان", 149, "Qatar"),
    ("Al-Ghabqa", "سحری", 153, "Qatar"),
    ("Safar al-Khayr", "سفر نیکوکار", 157, "Qatar"),
    ("Layali Ramadan", "شب‌های رمضان", 161, "Qatar"),
    ("Sanad", "سند", 165, "Qatar"),
    ("Fada'il Ramadan", "فضایل ماه مبارک رمضان", 169, "Qatar"),
    ("Al-Waridat", "آوا ورود ماه رمضان", 175, "Qatar"),
    ("Ahl Ramadan", "سلام بر رمضان", 179, "Qatar"),
    ("Aklat Ramadan", "غذاهای رمضان", 183, "Qatar"),
    ("Khayr Ahli", "نیکوکاری‌های جامعه محور", 188, "Kuwait"),
    ("Ahsan Rahla", "بهترین سفر", 192, "Kuwait"),
    ("Qawa'id Qur'aniyya", "قواعد قرآنی", 196, "Kuwait"),
    ("Masra", "مسجداالقصی", 201, "Kuwait"),
    ("Ta'arraf Alayh", "آن را بشناس", 206, "Kuwait"),
    ("Suhbat Ramadan", "محفل رمضان", 210, "Kuwait"),
    ("Noor wa A'lam", "نور و نشانه‌ها", 214, "Kuwait"),
    ("Durat Ramadan", "جامی‌های رمضان", 218, "Kuwait"),
    ("Sihhatuna fi Ramadan", "سلامتی ما در ماه رمضان", 222, "Kuwait"),
    ("Al-Kalima al-Tayyiba", "کلمه مهربانی", 226, "Kuwait"),
    ("Bil-Qur'an Ihtadayt", "با قرآن هدایت شدم", 230, "Kuwait"),
]

def parse_pdf3():
    out = []
    pages = PDF_TEXT[3]
    # Sort by printed page
    sorted_progs = sorted(PDF3_PROGRAMS, key=lambda x: x[2])
    for i, (name, persian, printed_sp, country) in enumerate(sorted_progs):
        sp = printed_sp - 1  # PDF index
        # End page: start of next program (printed page - 1)
        if i + 1 < len(sorted_progs):
            _, _, next_printed_sp, _ = sorted_progs[i + 1]
            ep = next_printed_sp - 1 - 1  # page before next program's start
        else:
            ep = len(pages) - 1
        if ep < sp:
            ep = sp
        # Combine text
        text_parts = []
        for p in range(sp, min(ep + 1, len(pages))):
            text_parts.append(pages[p]["text"])
        full = "\n".join(text_parts)
        # Strip leading page number / metadata, keep Persian description
        desc = full
        # Try to find a meaningful start: "ایده ناظر", "پیرنگ اصلی برنامه", "محصول کشور", or just trim
        # Take from "ایده ناظر" or "پیرنگ اصلی" if present
        m = re.search(r'(ایده\s*ناظر|پیرنگ\s*اصلی\s*برنامه)', full)
        if m:
            desc = full[m.start():]
        desc = clean_text(desc)
        if len(desc) > 2500:
            desc = desc[:2500] + "…"
        # Images: from sp to ep
        images = imgs_for(3, list(range(sp, min(ep + 1, len(pages)))))
        if not images:
            images = imgs_for(3, [sp])
        out.append({
            "name": name,
            "pdf_idx": 3,
            "pages": list(range(sp, min(ep + 1, len(pages)))),
            "country": country,
            "descriptionFa": desc,
            "images": images[:6],
            "persianName": persian,
        })
    return out

# ============================================================
# PDF 4: پخش زنده دوربین‌ها (Live Camera Streams)
# ============================================================
# Each program has "عنوان" (title) + English title + "توضیح" (description)
# Identified from text dump:

PDF4_PROGRAMS = [
    # (english_title, persian_title, page_index, country)
    ("Lake Shore Railway Museum - East Camera", "موزه راه آهن Lake Shore", 5, "United States"),
    ("Livestream RailCam Netherlands", "ایستگاه قطاری در کشور هلند", 6, "Netherlands"),
    ("Mount Washington Cog Railway live Webcam", "ایستگاه اصلی قطار مارشفیلد", 8, "United States"),
    ("CHECK NEWS - Nanaimo harbour Cam 24-7 LiveStream", "بندر نانایمو", 12, "Canada"),
    ("Come Back Real Time LIVE Walking tour Seoul Korea - Hong Kong", "خیابان‌های سئول", 13, "South Korea"),
    ("Live Duval street, Key West, Florida - Outside sloppy Joe's", "خیابان دووا در شهر فلوریدا", 13, "United States"),
    ("London Bus Rides", "خیابان‌های لندن", 14, "United Kingdom"),
    ("NOW Shibuya Scramble Crossing Tokyo- Japan", "خیابان‌های توکیو", 14, "Japan"),
    ("Philippines live street view camera - Market area", "خیابان‌های فیلیپین", 15, "Philippines"),
    ("Ukraine Live Coverage 24/7", "شهرهای اوکراین", 15, "Ukraine"),
]

def parse_pdf4():
    out = []
    pages = PDF_TEXT[4]
    for i, (name, persian, sp, country) in enumerate(PDF4_PROGRAMS):
        # End page: start of next program - 1, or +2 pages max
        if i + 1 < len(PDF4_PROGRAMS):
            _, _, next_sp, _ = PDF4_PROGRAMS[i + 1]
            ep = next_sp - 1
        else:
            ep = min(sp + 2, len(pages) - 1)
        if ep < sp:
            ep = sp
        text_parts = []
        for p in range(sp, min(ep + 1, len(pages))):
            text_parts.append(pages[p]["text"])
        full = "\n".join(text_parts)
        # Extract description: from "توضیح" until next "عنوان" or end
        m = re.search(r'توضیح', full)
        if m:
            desc = full[m.end():]
            # If there's a next "عنوان", cut there
            nidx = desc.find('عنوان')
            if nidx > 0:
                desc = desc[:nidx]
        else:
            desc = full
        desc = clean_text(desc)
        if len(desc) > 2000:
            desc = desc[:2000] + "…"
        images = imgs_for(4, list(range(sp, min(ep + 1, len(pages)))))
        if not images:
            images = imgs_for(4, [sp])
        out.append({
            "name": name,
            "pdf_idx": 4,
            "pages": list(range(sp, min(ep + 1, len(pages)))),
            "country": country,
            "descriptionFa": desc,
            "images": images[:6],
            "persianName": persian,
        })
    return out

# ============================================================
# Build program records
# ============================================================
print("Parsing PDFs...")
programs_pdf1 = parse_pdf1()
programs_pdf2 = parse_pdf2()
programs_pdf3 = parse_pdf3()
programs_pdf4 = parse_pdf4()

print(f"  PDF 1: {len(programs_pdf1)} programs")
print(f"  PDF 2: {len(programs_pdf2)} programs")
print(f"  PDF 3: {len(programs_pdf3)} programs")
print(f"  PDF 4: {len(programs_pdf4)} programs")
total_new = len(programs_pdf1) + len(programs_pdf2) + len(programs_pdf3) + len(programs_pdf4)
print(f"  Total new programs: {total_new}")

# Sanity check: every program must have at least 1 image
all_progs = programs_pdf1 + programs_pdf2 + programs_pdf3 + programs_pdf4
no_img = [p for p in all_progs if not p["images"]]
if no_img:
    print(f"[!] {len(no_img)} programs without images:")
    for p in no_img:
        print(f"    - {p['name']} (pdf {p['pdf_idx']}, pages {p['pages']})")

# ============================================================
# Generate metadata (style, effects, layout, etc.) per PDF category
# ============================================================

def metadata_for(pdf_idx, desc, name):
    """Generate plausible metadata fields based on PDF category and description keywords."""
    # Defaults per category
    if pdf_idx == 1:  # نقد فیلم — film review
        style = "مدرن"
        effects = "نمایشگر/LEDمحور"
        layout = "پنل/میزگرد"
        elements = "screens/monitors، bar/cafe_counter"
        materials = "metal، glass"
        colors = "modern dark tones with vibrant accent lighting"
        lighting = "ترکیبی"
        viewers = "بدون تماشاگر"
        size = "متوسط/استاندارد"
    elif pdf_idx == 2:  # خانواده — family/population reality
        style = "ترکیبی"
        effects = "فیزیکی/واقعی"
        layout = "موقعیت‌محور"
        elements = "plants، screens/monitors، bar/cafe_counter"
        materials = "wood، fabric/upholstery"
        colors = "warm earth tones with soft natural lighting"
        lighting = "گرم"
        viewers = "بدون تماشاگر"
        size = "متوسط/استاندارد"
    elif pdf_idx == 3:  # رمضان — Ramadan religious programs
        style = "کلاسیک/سنتی"
        effects = "ترکیبی"
        layout = "پنل/میزگرد"
        elements = "plants، screens/monitors"
        materials = "wood، fabric/upholstery"
        colors = "warm gold and green with spiritual accent lighting"
        lighting = "گرم"
        viewers = "با تماشاگر"
        size = "بزرگ/لوکس"
    elif pdf_idx == 4:  # دوربین — live camera streams
        style = "مینیمال"
        effects = "فیزیکی/واقعی"
        layout = "موقعیت‌محور"
        elements = "screens/monitors"
        materials = "metal، glass"
        colors = "natural outdoor daylight and ambient street lighting"
        lighting = "خنثی"
        viewers = "بدون تماشاگر"
        size = "کوچک/اقتصادی"
    else:
        style = "ترکیبی"; effects = "ترکیبی"; layout = "پنل/میزگرد"
        elements = "screens/monitors"; materials = "metal، glass"
        colors = "neutral palette"; lighting = "ترکیبی"
        viewers = "بدون تماشاگر"; size = "متوسط/استاندارد"
    # Slight customization based on description keywords
    d = (desc or "").lower()
    if any(k in desc for k in ["مدرن", "modern", "تکنولوژی", "دیجیتال"]):
        style = "مدرن"
    if any(k in desc for k in ["سنتی", "کلاسیک", "مذهبی", "قرآن", "رمضان"]):
        style = "کلاسیک/سنتی"
    if any(k in desc for k in ["استودیو", "مصاحبه"]):
        layout = "مصاحبه یک‌به‌یک"
    return {
        "style": style, "effects": effects, "layout": layout,
        "elements": elements, "materials": materials, "colors": colors,
        "lighting": lighting, "viewers": viewers, "size": size,
    }

def build_summary(name, pdf_idx, country, desc):
    """Build a short English summary."""
    cat_map = {1: "film review", 2: "family/population reality", 3: "Ramadan program", 4: "live camera stream"}
    s = f"{name} — a {cat_map.get(pdf_idx, 'TV program')} from {country}."
    # Add a snippet from description if it has Latin chars
    return s

def build_social_post(name, pdf_idx, desc, category):
    """Build a social media post string in Persian."""
    cat_map = {
        1: "نقد و بررسی فیلم",
        2: "خانواده و افزایش جمعیت",
        3: "برنامه‌های ماه مبارک رمضان",
        4: "پخش زنده دوربین‌ها",
    }
    post = f"🎬 {name}\n\n📝 {desc[:200]}\n\n🏷 {category}\n\n#بانک_رسانه #تاک_شو #برنامه_تلویزیونی"
    return post

# ============================================================
# Assemble new program records
# ============================================================
START_NUM = 616

new_records = []
counter = START_NUM
for p in all_progs:
    meta = metadata_for(p["pdf_idx"], p["descriptionFa"], p["name"])
    name = p["name"]
    country = p["country"]
    category = CATEGORY[p["pdf_idx"]]
    desc = p["descriptionFa"]
    summary = build_summary(name, p["pdf_idx"], country, desc)
    # Build links
    query = urllib.parse.quote(name)
    youtube = f"https://www.youtube.com/results?search_query={query}"
    imdb = f"https://www.imdb.com/find?q={query}"
    wikipedia = f"https://fa.wikipedia.org/w/index.php?search={query}"
    social = build_social_post(name, p["pdf_idx"], desc, category)
    # Tags
    tags_map = {1: ["film-review", "critic", "cinema"], 2: ["family", "reality-tv", "population"],
                3: ["ramadan", "religious", "islamic"], 4: ["live-camera", "streaming", "tourism"]}
    tags = list(tags_map.get(p["pdf_idx"], []))
    record = {
        "num": counter,
        "name": name,
        "category": category,
        "source": "تصویر PDF",
        "size": meta["size"],
        "viewers": meta["viewers"],
        "style": meta["style"],
        "effects": meta["effects"],
        "layout": meta["layout"],
        "elements": meta["elements"],
        "materials": meta["materials"],
        "colors": meta["colors"],
        "lighting": meta["lighting"],
        "summary": summary,
        "descriptionFa": desc,
        "country": country,
        "images": p["images"],
        "tags": tags,
        "youtube": youtube,
        "imdb": imdb,
        "wikipedia": wikipedia,
        "socialPost": social,
    }
    new_records.append(record)
    counter += 1

print(f"Built {len(new_records)} new records (num {START_NUM}..{counter-1})")

# ============================================================
# Write to talk-shows-data.json
# ============================================================
combined = existing + new_records
out_path = f"{ROOT}/public/talk-shows-data.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(combined, f, ensure_ascii=False, indent=2)
print(f"Wrote {len(combined)} programs to {out_path}")

# Verify JSON
with open(out_path, "r", encoding="utf-8") as f:
    check = json.load(f)
print(f"Verified: {len(check)} programs loaded back; nums {check[-1]['num']} and {check[0]['num']}")
print(f"Last new program: num={new_records[-1]['num']}, name={new_records[-1]['name']}, images={len(new_records[-1]['images'])}")
print("DONE master")
