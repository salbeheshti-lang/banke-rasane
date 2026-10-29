"""Step 3 (batch 2): Master parser.

Parse programs from all 4 new PDFs, build program records, append to
public/talk-shows-data.json starting from num 737.

PDFs:
  1. اهدای عضو.pdf                 -> category: "آگهی‌های تبلیغاتی"   (genre: ads)
  2. برنامه_های پلیسی.pdf          -> category: "برنامه‌های پلیسی"   (genre: police)
  3. برنامه_های مرتبط با قانون اساسی.PDF -> category: "قانون اساسی" (genre: constitution)
  4. برنامه_های تلویزیونی - صرفه_جویی در مصرف انرژی.pdf
                                    -> category: "صرفه‌جویی در مصرف انرژی" (genre: energy-saving)
"""
import json
import os
import re
import urllib.parse
import io

ROOT = "/home/z/my-project"

# ============================================================
# Load image map: {"pdf_idx_page": [image_paths]}
# ============================================================
with open(f"{ROOT}/scripts/pdf_extract2/image_map.json", "r", encoding="utf-8") as f:
    IMAGE_MAP = json.load(f)


def imgs_for(pdf_idx, page_indices):
    """Return all non-blank image paths for the given PDF index and page range (inclusive)."""
    out = []
    for p in page_indices:
        key = f"{pdf_idx}_{p}"
        if key in IMAGE_MAP:
            out.extend(IMAGE_MAP[key])
    # Dedupe while preserving order
    seen = set()
    dedup = []
    for x in out:
        if x not in seen:
            seen.add(x)
            dedup.append(x)
    return dedup


# ============================================================
# Load existing data
# ============================================================
with open(f"{ROOT}/public/talk-shows-data.json", "r", encoding="utf-8") as f:
    existing = json.load(f)
print(f"Existing programs: {len(existing)}, max num: {max(p['num'] for p in existing)}")

# ============================================================
# Load each PDF's text
# ============================================================
PDF_TEXT = {}
LABELS = {1: "ads", 2: "police", 3: "constitution", 4: "energy-saving"}
for i in [1, 2, 3, 4]:
    with open(f"{ROOT}/scripts/pdf_extract2/pdf{i}_{LABELS[i]}_text.json", "r", encoding="utf-8") as f:
        PDF_TEXT[i] = json.load(f)["pages"]


# ============================================================
# Helper: clean Persian text
# ============================================================
def clean_text(s):
    if not s:
        return ""
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


# ============================================================
# Categories (Persian) per PDF
# ============================================================
CATEGORY = {
    1: "آگهی‌های تبلیغاتی",
    2: "برنامه‌های پلیسی",
    3: "قانون اساسی",
    4: "صرفه‌جویی در مصرف انرژی",
}

# ============================================================
# Persian country names -> English (longer names first)
# ============================================================
COUNTRY_FA_EN = {
    "آفریقای جنوبی": "South Africa",
    "آمریکا": "United States",
    "آمریکایی": "United States",
    "ایالات متحده": "United States",
    "ایاالت متحده": "United States",  # broken Persian
    "ایالت متحده": "United States",
    "انگلستان": "United Kingdom",
    "بریتانیایی": "United Kingdom",
    "بریتانیا": "United Kingdom",
    "هلند": "Netherlands",
    "ژاپن": "Japan",
    "کره جنوبی": "South Korea",
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
    "آلمان غربی": "Germany",
    "فرانسه": "France",
    "استرالیا": "Australia",
    "استرال": "Australia",  # broken Persian
    "کانادا": "Canada",
    "ایرلند": "Ireland",
    "اسکاتلند": "Scotland",
    "نیجریه": "Nigeria",
    "هند": "India",
    "ایتالیا": "Italy",
    "اسپانیا": "Spain",
    "سوئد": "Sweden",
    "نروژ": "Norway",
    "دانمارک": "Denmark",
    "فنلاند": "Finland",
    "روسیه": "Russia",
    "چین": "China",
    "برزیل": "Brazil",
    "آرژانتین": "Argentina",
    "مکزیک": "Mexico",
    "مصر": "Egypt",
    "عراق": "Iraq",
    "سوریه": "Syria",
    "افغانستان": "Afghanistan",
    "پاکستان": "Pakistan",
    "سوئیس": "Switzerland",
    "بلژیک": "Belgium",
    "اتریش": "Austria",
    "پرتغال": "Portugal",
    "یونان": "Greece",
    "لهستان": "Poland",
    "مجارستان": "Hungary",
    "چک": "Czech Republic",
    "رومانی": "Romania",
    "بلغارستان": "Bulgaria",
    "کرواسی": "Croatia",
    "صربستان": "Serbia",
}


def detect_country(text, near_title_only=False):
    """Detect country from text using word-boundary regex (Persian-aware).

    If near_title_only=True, only look at the first ~500 chars (where the title
    and country-of-origin are typically stated), avoiding false matches with
    countries mentioned later in the description as comparisons/examples.

    Returns the FIRST country mentioned in the text (by position).
    """
    if not text:
        return "Unknown"
    if near_title_only:
        text = text[:500]
    norm = re.sub(r'\s+', ' ', text)
    # Find all matches and pick the one that appears earliest in the text
    matches = []  # list of (start_pos, en_name)
    for fa_name, en_name in COUNTRY_FA_EN.items():
        escaped = re.escape(fa_name)
        pattern = r'(^|[^\u0600-\u06FF])' + escaped + r'(?=[^\u0600-\u06FF]|$)'
        m = re.search(pattern, norm)
        if m:
            matches.append((m.start(), en_name))
    if matches:
        # Sort by position; earliest match wins
        matches.sort(key=lambda x: x[0])
        return matches[0][1]
    # Fallback: check network names
    net_text = norm[:1500]
    if 'MTV' in net_text and 'بریتانیا' in net_text:
        return 'United Kingdom'
    if 'BBC' in net_text:
        return 'United Kingdom'
    if 'CBS' in net_text or 'NBC' in net_text or 'ABC' in net_text or 'Fox' in net_text or 'TNT' in net_text:
        return 'United States'
    if 'Netflix' in net_text or 'نتفلیکس' in net_text:
        return 'United States'
    if 'Discovery' in net_text or 'Animal planet' in net_text or 'Animal Planet' in net_text:
        return 'United States'
    if 'PBS' in net_text:
        return 'United States'
    if 'CBC' in net_text:
        return 'Canada'
    if 'CTV' in net_text:
        return 'Canada'
    if 'HGTV' in net_text or 'Planet Green' in net_text:
        return 'United States'
    if 'tvN' in net_text or 'TVN' in net_text:
        return 'South Korea'
    if 'Channel 4' in net_text:
        return 'United Kingdom'
    if 'BBC Three' in net_text or 'BBC One' in net_text:
        return 'United Kingdom'
    return 'Unknown'


# ============================================================
# PDF 1: اهدای عضو (Organ Donation Programs)
# ============================================================
# Three sections, each numbered 1..N:
#   Section A (pages 2-29): 29 series
#   Section B (pages 31-52): 20 TV shows
#   Section C (pages 54-72): 19 movies

def parse_pdf1_ads():
    pages = PDF_TEXT[1]
    out = []

    # Detect all program-start positions: each line that begins with "N." where N=1..99.
    # Multiple programs may start on the same page, so we use finditer and
    # also track the character offset within the page so we can split correctly.
    starts = []  # list of (page_idx, char_pos, num, section_id)
    section_id = 0
    prev_num = 0
    for p in pages:
        txt = p['text']
        for m in re.finditer(r'(?m)^\s*(\d{1,3})\s*\.', txt):
            num = int(m.group(1))
            if not (1 <= num <= 99):
                continue
            # Section reset: number drops back to 1
            if num == 1 and prev_num >= 1:
                section_id += 1
            starts.append((p['pno'], m.start(), num, section_id))
            prev_num = num

    # Pre-build a per-page footnote index:
    # page_footnotes[page_idx] = list of (fn_num, fn_text)
    # Note: footnote lines look like "1 English Name" (digit + space + Latin text).
    # The Latin text may start with a digit (e.g., "1 21 Grams", "1 2 Hearts"),
    # contain asterisks (e.g., "1 MAS*H"), or use Unicode punctuation (e.g., "1 My Sister's Keeper").
    def parse_footnote(s):
        m = re.match(r'^(\d{1,2})\s+(\S.{1,80})$', s)
        if not m:
            return None
        fn_num = int(m.group(1))
        text = m.group(2).strip()
        if fn_num > 30 or len(text) < 2:
            return None
        # Require at least one Latin letter
        latin = sum(1 for c in text if c.isascii() and c.isalpha())
        if latin < 1:
            return None
        # Reject if mostly Persian (these are description lines, not footnotes)
        persian = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
        if persian > latin:
            return None
        return (fn_num, text)

    page_footnotes = {}
    for p in pages:
        fns = []
        for line in p['text'].split('\n'):
            s = line.strip()
            if not s:
                continue
            fn = parse_footnote(s)
            if fn:
                fns.append(fn)
        page_footnotes[p['pno']] = fns

    # Build program sections from consecutive starts
    for i in range(len(starts)):
        page_idx, char_pos, num, sec_id = starts[i]
        # End position: next start (page_idx, char_pos) or end-of-document
        if i + 1 < len(starts):
            next_page_idx, next_char_pos, _, _ = starts[i + 1]
        else:
            next_page_idx, next_char_pos = len(pages), 0

        # Combine text from page_idx (starting at char_pos) up to next start
        text_parts = []
        text_parts.append(pages[page_idx]['text'][char_pos:])
        for p in range(page_idx + 1, next_page_idx):
            text_parts.append(pages[p]['text'])
        # If next start is on the same page we started on, trim back to that position
        if next_page_idx == page_idx and next_char_pos > char_pos:
            # Re-do: take only [char_pos:next_char_pos] from first page
            text_parts = [pages[page_idx]['text'][char_pos:next_char_pos]]
        full = "\n".join(text_parts)

        # --- Extract Persian title + superscript marker: «PersianName<marker>...» ---
        # The «...» block may contain multiple digits (e.g., «فیلم2\nقلب1» where "2" is the
        # program-type marker and "1" is the title's footnote marker). We want the LAST digit
        # before the closing », since the title's marker is typically right before ».
        fa_block_match = re.search(r'«([^»\n]+?)»', full)
        fa_title = None
        fa_marker = None
        if fa_block_match:
            block = fa_block_match.group(1)
            # Find all digit sequences in the block
            digits = list(re.finditer(r'\d+', block))
            if digits:
                last_digit = digits[-1]
                fa_marker = int(last_digit.group(0))
                # Title is the text between the last newline (before the marker) and the marker
                pre_marker = block[:last_digit.start()]
                # Take the text after the last newline in pre_marker
                last_nl = pre_marker.rfind('\n')
                fa_title = pre_marker[last_nl + 1:].strip() if last_nl >= 0 else pre_marker.strip()
                # Strip leading program-type words ("فیلم", "سریال", "برنامه", "مجموعه تلویزیونی")
                fa_title = re.sub(r'^(فیلم|سریال|برنامه|مجموعه\s*تلویزیونی)\s*', '', fa_title).strip()
                if not fa_title:
                    fa_title = None
            else:
                # No marker in block; just use the block content as title
                fa_title = block.strip()
                # Strip leading program-type words
                fa_title = re.sub(r'^(فیلم|سریال|برنامه|مجموعه\s*تلویزیونی)\s*', '', fa_title).strip() or None

        # Hardcoded overrides for programs whose names can't be auto-extracted reliably.
        # Keyed by (section_id, num, page_idx).
        NAME_OVERRIDES_PDF1 = {
            (0, 6, 6): "Combat Hospital",   # «بیمارستان جنگی7» — same-page footnotes batched
            (0, 27, 27): "Fringe",          # «فرینج» has no marker; only person-name footnotes
            (1, 9, 39): "The Gift",         # «هدیه» no marker; URL has The_Gift
            (1, 14, 46): "Organ Donation Awareness",  # Latin text in description
            (1, 18, 50): "How Keira's heart saved Max",
            (1, 19, 51): "Meeting donor's family",
            (2, 2, 55): "2 Hearts",         # «فیلم2\nقلب1» — regex picks wrong digit
        }
        override = NAME_OVERRIDES_PDF1.get((sec_id, num, page_idx))

        # --- Extract English name from footnotes ---
        # Footnotes for this program are typically at the END of the LAST page
        # of the program's text span. If the program shares a page with the next
        # program, the footnotes appear after the next program's start position
        # on that same page.
        last_page = next_page_idx - 1 if next_page_idx > page_idx else page_idx
        # Also consider the page where the program starts (in case last_page is wrong)
        candidate_pages = [last_page, page_idx]
        # Add the next page too in case footnotes spilled over
        if last_page + 1 < len(pages):
            candidate_pages.append(last_page + 1)

        en_name = None
        # 1. Use hardcoded override if available
        if override:
            en_name = override

        # 2. Look up by footnote marker
        if not en_name and fa_marker is not None:
            for pg in candidate_pages:
                if pg < 0 or pg >= len(pages):
                    continue
                for fn_num, fn_text in page_footnotes.get(pg, []):
                    if fn_num == fa_marker:
                        en_name = fn_text
                        break
                if en_name:
                    break

        # 3. Fallback: smallest-numbered footnote on candidate pages
        if not en_name:
            for pg in candidate_pages:
                if pg < 0 or pg >= len(pages):
                    continue
                fns = page_footnotes.get(pg, [])
                if fns:
                    fns_sorted = sorted(fns, key=lambda x: x[0])
                    en_name = fns_sorted[0][1]
                    break

        # 4. Fallback: search ALL lines for Latin-script text (looks like a title, not a URL)
        if not en_name:
            for line in full.split('\n'):
                s = line.strip()
                if not s or len(s) < 3 or len(s) > 80:
                    continue
                if re.match(r'^https?://', s):
                    continue
                if re.match(r'^\d+\s', s):  # skip footnote-like lines (already tried)
                    continue
                latin = sum(1 for c in s if c.isascii() and c.isalpha())
                persian = sum(1 for c in s if '\u0600' <= c <= '\u06FF')
                if latin >= 3 and persian == 0:
                    if not re.fullmatch(r'[\d\s\-\.]+', s):
                        en_name = s
                        break

        # --- Extract description: Persian text after the title block ---
        desc = full
        if fa_block_match:
            after_title_pos = full.find('»', fa_block_match.start())
            if after_title_pos >= 0:
                desc = full[after_title_pos + 1:]
        # Remove footnote lines (digit + Latin text) and URLs from description
        desc_lines = []
        for line in desc.split('\n'):
            s = line.strip()
            if not s:
                continue
            # Skip footnote lines (digit + Latin text)
            if re.match(r'^\d+\s+[A-Za-z0-9]', s):
                continue
            if re.match(r'^https?://', s):
                continue
            # Skip lines that are mostly Latin (footnote refs / standalone English titles)
            latin = sum(1 for c in s if c.isascii() and c.isalpha())
            persian = sum(1 for c in s if '\u0600' <= c <= '\u06FF')
            if latin > persian and latin >= 5 and persian == 0:
                continue
            desc_lines.append(s)
        desc = ' '.join(desc_lines)
        desc = clean_text(desc)
        if len(desc) > 2500:
            desc = desc[:2500] + '…'

        # --- Country (look at title-area text only, to avoid matching comparison mentions) ---
        country = detect_country(full[:600], near_title_only=True)
        if country == 'Unknown':
            country = detect_country(full)
        if country == 'Unknown':
            country = 'Unknown'

        # --- Images: pages this program spans ---
        page_range = list(range(page_idx, min(last_page + 1, len(pages))))
        images = imgs_for(1, page_range)

        out.append({
            "name": en_name or fa_title or f"Program {num}",
            "pdf_idx": 1,
            "pages": page_range,
            "country": country,
            "descriptionFa": desc,
            "images": images[:6],
            "fa_title": fa_title,
            "section": sec_id,
        })
    return out


# ============================================================
# PDF 2: برنامه_های پلیسی (Police Shows)
# ============================================================
# 19 detailed programs at known page starts:
POLICE2_PROGRAMS = [
    # (english_name, start_page)
    ("Forensic Files", 10),
    ("The First 48", 20),
    ("Las Vegas Jailhouse", 32),
    ("Unsolved Mysteries with Dennis Farina", 39),
    ("Cajun Justice", 56),
    ("Police Interceptors", 62),
    ("Live PD Presents: PD Cam", 74),
    ("Police Stop!", 83),
    ("The Force: Behind the Line", 92),
    ("Beach Cops", 102),
    ("Road Wars", 108),
    ("Highway Patrol", 119),
    ("Police Women of Dallas", 128),
    ("Real Detective", 137),
    ("Animal Black Ops", 152),
    ("Wild Justice", 163),
    ("Gold Coast Cops", 178),
    ("Through a Blue Lens", 188),
    ("Police Academy UK", 204),
]


def parse_pdf2_police():
    pages = PDF_TEXT[2]
    out = []
    for i, (name, sp) in enumerate(POLICE2_PROGRAMS):
        if i + 1 < len(POLICE2_PROGRAMS):
            ep = POLICE2_PROGRAMS[i + 1][1] - 1
        else:
            ep = 228  # before the table that starts at page 229
        if ep < sp:
            ep = sp
        page_range = list(range(sp, min(ep + 1, len(pages))))
        text_parts = [pages[p]['text'] for p in page_range]
        full = "\n".join(text_parts)

        # Country: detect from text (محصول <country>)
        country = detect_country(full)
        if country == 'Unknown':
            country = 'United States'  # default for police shows

        # Description: clean text after the title; remove footnotes/URLs
        desc = full
        # Find English title in text and start description after it
        idx_en = full.find(name)
        if idx_en >= 0:
            desc = full[idx_en + len(name):]
        # Cut at "محصول" if present (description starts after country line)
        m = re.search(r'محصول[^\n]*\n', desc)
        if m:
            desc = desc[m.end():]
        # Remove pure-Latin lines (footnote refs, URLs)
        desc_lines = []
        for line in desc.split('\n'):
            s = line.strip()
            if not s:
                continue
            if re.match(r'^\d+\s+[A-Z]', s):
                continue
            if re.match(r'^https?://', s):
                continue
            latin = sum(1 for c in s if c.isascii() and c.isalpha())
            persian = sum(1 for c in s if '\u0600' <= c <= '\u06FF')
            if latin > persian and latin >= 5 and persian == 0:
                continue
            desc_lines.append(s)
        desc = ' '.join(desc_lines)
        desc = clean_text(desc)
        if len(desc) > 2500:
            desc = desc[:2500] + '…'

        images = imgs_for(2, page_range)
        out.append({
            "name": name,
            "pdf_idx": 2,
            "pages": page_range,
            "country": country,
            "descriptionFa": desc,
            "images": images[:6],
        })
    return out


# ============================================================
# PDF 3: برنامه_های مرتبط با قانون اساسی (Constitutional Law)
# ============================================================
# 9 programs, each starts with "رنامه :" (broken "برنامه :") followed by English name on next line

def parse_pdf3_constitution():
    pages = PDF_TEXT[3]
    out = []
    # Find all program-start positions: "رنامه\s*:" followed by English name
    starts = []  # list of (page_idx, en_name, char_pos)
    for p in pages:
        txt = p['text']
        for m in re.finditer(r'رنامه\s*:\s*\n\s*([A-Za-z][^\n]+)', txt):
            en_name = m.group(1).strip()
            # Filter out spurious matches (must look like a title)
            if len(en_name) < 3:
                continue
            starts.append((p['pno'], en_name, m.start()))

    # Add sentinel
    starts.append((len(pages), None, 0))

    for i in range(len(starts) - 1):
        page_idx, en_name, mstart = starts[i]
        next_page_idx = starts[i + 1][0]
        page_range = list(range(page_idx, next_page_idx))
        text_parts = []
        # First page: slice from mstart
        text_parts.append(pages[page_idx]['text'][mstart:])
        for p in range(page_idx + 1, next_page_idx):
            text_parts.append(pages[p]['text'])
        full = "\n".join(text_parts)

        # Country: detect from text
        country = detect_country(full)
        if country == 'Unknown':
            country = 'United States'  # constitution shows mostly American

        # Description: clean text after the title
        desc = full
        # Find "مهمانان" (guests) marker and start after it
        m = re.search(r'مهمانان[^\n]*\n', desc)
        if m:
            desc = desc[m.end():]
        # Remove URLs
        desc_lines = []
        for line in desc.split('\n'):
            s = line.strip()
            if not s:
                continue
            if re.match(r'^https?://', s):
                continue
            latin = sum(1 for c in s if c.isascii() and c.isalpha())
            persian = sum(1 for c in s if '\u0600' <= c <= '\u06FF')
            if latin > persian and latin >= 5 and persian == 0:
                continue
            desc_lines.append(s)
        desc = ' '.join(desc_lines)
        desc = clean_text(desc)
        if len(desc) > 2500:
            desc = desc[:2500] + '…'

        images = imgs_for(3, page_range)
        out.append({
            "name": en_name,
            "pdf_idx": 3,
            "pages": page_range,
            "country": country,
            "descriptionFa": desc,
            "images": images[:6],
        })
    return out


# ============================================================
# PDF 4: برنامه_های تلویزیونی - صرفه_جویی در مصرف انرژی
# ============================================================
# 13 programs each on a single page; marker is "N-" at start of line

def parse_pdf4_energy():
    pages = PDF_TEXT[4]
    out = []
    starts = []  # (page_idx, num)
    for p in pages:
        txt = p['text']
        m = re.search(r'(?m)^\s*(\d{1,2})\s*-\s', txt)
        if not m:
            continue
        num = int(m.group(1))
        if not (1 <= num <= 30):
            continue
        starts.append((p['pno'], num, m.start()))
    starts.append((len(pages), 0, 0))

    for i in range(len(starts) - 1):
        page_idx, num, mstart = starts[i]
        next_page_idx = starts[i + 1][0]
        page_range = list(range(page_idx, next_page_idx))
        text_parts = []
        text_parts.append(pages[page_idx]['text'][mstart:])
        for p in range(page_idx + 1, next_page_idx):
            text_parts.append(pages[p]['text'])
        full = "\n".join(text_parts)

        # English name: longest Latin-script substring in the first 15 lines
        lines = full.split('\n')[:15]
        en_name = None
        best_len = 0
        for line in lines:
            # Find Latin-script sequences
            for m in re.finditer(r'[A-Za-z][A-Za-z0-9\s\$\&\'\-\.&:!?()\/]+', line):
                s = m.group(0).strip()
                # Strip trailing junk like ") (" or year
                s2 = re.sub(r'[\)\(]+.*$', '', s).strip()
                s2 = re.sub(r'\s+', ' ', s2)
                # Filter out year-only / too short
                if len(s2) < 3:
                    continue
                if re.fullmatch(r'[\d\s\-]+', s2):
                    continue
                if len(s2) > best_len:
                    best_len = len(s2)
                    en_name = s2
        # Clean trailing year
        if en_name:
            en_name = re.sub(r'\s*\(\d{4}[\-\d]*\)\s*$', '', en_name).strip()
            en_name = re.sub(r'\s+', ' ', en_name)

        # Persian title: between « and »
        fa_match = re.search(r'«([^»\n]+?)»', full)
        fa_title = fa_match.group(1).strip() if fa_match else None

        # Country: detect from text
        country = detect_country(full)

        # Description: clean text after the marker and title
        desc = full
        if fa_match:
            after = full.find('»', fa_match.start())
            if after >= 0:
                desc = full[after + 1:]
        desc_lines = []
        for line in desc.split('\n'):
            s = line.strip()
            if not s:
                continue
            if re.match(r'^https?://', s):
                continue
            if re.match(r'^\d+\.\s', s):  # footnotes
                continue
            latin = sum(1 for c in s if c.isascii() and c.isalpha())
            persian = sum(1 for c in s if '\u0600' <= c <= '\u06FF')
            if latin > persian and latin >= 5 and persian == 0:
                continue
            desc_lines.append(s)
        desc = ' '.join(desc_lines)
        desc = clean_text(desc)
        if len(desc) > 2500:
            desc = desc[:2500] + '…'

        images = imgs_for(4, page_range)
        out.append({
            "name": en_name or fa_title or f"Program {num}",
            "pdf_idx": 4,
            "pages": page_range,
            "country": country,
            "descriptionFa": desc,
            "images": images[:6],
            "fa_title": fa_title,
        })
    return out


# ============================================================
# Run all parsers
# ============================================================
print("Parsing PDFs...")
programs_pdf1 = parse_pdf1_ads()
programs_pdf2 = parse_pdf2_police()
programs_pdf3 = parse_pdf3_constitution()
programs_pdf4 = parse_pdf4_energy()

print(f"  PDF 1 (ads):          {len(programs_pdf1)} programs")
print(f"  PDF 2 (police):       {len(programs_pdf2)} programs")
print(f"  PDF 3 (constitution): {len(programs_pdf3)} programs")
print(f"  PDF 4 (energy):       {len(programs_pdf4)} programs")
total_new = len(programs_pdf1) + len(programs_pdf2) + len(programs_pdf3) + len(programs_pdf4)
print(f"  Total new programs:   {total_new}")

# Sanity check: every program must have a name and description
all_progs = programs_pdf1 + programs_pdf2 + programs_pdf3 + programs_pdf4
no_img = [p for p in all_progs if not p["images"]]
print(f"[!] Programs with 0 images (will use fallback logo): {len(no_img)}")
for p in no_img[:5]:
    print(f"    - {p['name']} (pdf {p['pdf_idx']}, pages {p['pages'][:3]})")

# ============================================================
# Generate metadata (style, effects, layout, etc.) per PDF category
# ============================================================
def metadata_for(pdf_idx, desc, name):
    """Generate plausible metadata fields based on PDF category and description keywords."""
    if pdf_idx == 1:  # ads — organ donation / medical dramas
        style = "مدرن"
        effects = "نمایشگر/LEDمحور"
        layout = "موقعیت‌محور"
        elements = "screens/monitors، bar/cafe_counter"
        materials = "metal، glass"
        colors = "modern clinical tones with cool blue accent lighting"
        lighting = "ترکیبی"
        viewers = "بدون تماشاگر"
        size = "متوسط/استاندارد"
    elif pdf_idx == 2:  # police — crime reality / documentary
        style = "مدرن"
        effects = "فیزیکی/واقعی"
        layout = "موقعیت‌محور"
        elements = "screens/monitors، vehicles"
        materials = "metal، glass"
        colors = "naturalistic tones with night-vision and urban street lighting"
        lighting = "ترکیبی"
        viewers = "بدون تماشاگر"
        size = "متوسط/استاندارد"
    elif pdf_idx == 3:  # constitution — political/educational
        style = "ترکیبی"
        effects = "ترکیبی"
        layout = "مصاحبه یک‌به‌یک"
        elements = "screens/monitors، plants"
        materials = "wood، fabric/upholstery"
        colors = "warm earth tones with neutral studio lighting"
        lighting = "گرم"
        viewers = "بدون تماشاگر"
        size = "متوسط/استاندارد"
    elif pdf_idx == 4:  # energy-saving — educational/lifestyle
        style = "ترکیبی"
        effects = "فیزیکی/واقعی"
        layout = "موقعیت‌محور"
        elements = "plants، screens/monitors، bar/cafe_counter"
        materials = "wood، fabric/upholstery"
        colors = "natural greens and earth tones with daylight"
        lighting = "خنثی"
        viewers = "بدون تماشاگر"
        size = "متوسط/استاندارد"
    else:
        style = "ترکیبی"; effects = "ترکیبی"; layout = "پنل/میزگرد"
        elements = "screens/monitors"; materials = "metal، glass"
        colors = "neutral palette"; lighting = "ترکیبی"
        viewers = "بدون تماشاگر"; size = "متوسط/استاندارد"
    # Slight customization based on description keywords
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
    cat_map = {
        1: "organ donation / medical drama program",
        2: "police / crime reality show",
        3: "constitutional law educational program",
        4: "energy saving educational program",
    }
    s = f"{name} — a {cat_map.get(pdf_idx, 'TV program')} from {country}."
    return s


def build_social_post(name, pdf_idx, desc, category):
    """Build a social media post string in Persian."""
    snippet = (desc[:200] + '…') if len(desc) > 200 else desc
    post = f"🎬 {name}\n\n📝 {snippet}\n\n🏷 {category}\n\n#بانک_رسانه #تاک_شو #برنامه_تلویزیونی"
    return post


# ============================================================
# Assemble new program records
# ============================================================
START_NUM = 737
FALLBACK_IMAGE = ["/banke-rasane-logo.png"]

new_records = []
counter = START_NUM
for p in all_progs:
    meta = metadata_for(p["pdf_idx"], p["descriptionFa"], p["name"])
    name = p["name"]
    country = p["country"]
    category = CATEGORY[p["pdf_idx"]]
    desc = p["descriptionFa"]
    summary = build_summary(name, p["pdf_idx"], country, desc)
    query = urllib.parse.quote(name)
    youtube = f"https://www.youtube.com/results?search_query={query}"
    imdb = f"https://www.imdb.com/find?q={query}"
    wikipedia = f"https://fa.wikipedia.org/w/index.php?search={query}"
    social = build_social_post(name, p["pdf_idx"], desc, category)
    tags_map = {
        1: ["organ-donation", "medical", "drama"],
        2: ["police", "crime", "reality-tv"],
        3: ["constitution", "law", "educational"],
        4: ["energy-saving", "environment", "educational"],
    }
    tags = list(tags_map.get(p["pdf_idx"], []))
    images = p["images"] if p["images"] else list(FALLBACK_IMAGE)
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
        "images": images,
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
# Append to talk-shows-data.json
# ============================================================
combined = existing + new_records
out_path = f"{ROOT}/public/talk-shows-data.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(combined, f, ensure_ascii=False, indent=2)
print(f"Wrote {len(combined)} programs to {out_path}")

# Verify JSON
with open(out_path, "r", encoding="utf-8") as f:
    check = json.load(f)
print(f"Verified: {len(check)} programs loaded back; nums {check[0]['num']}..{check[-1]['num']}")
print(f"Last new program: num={new_records[-1]['num']}, name={new_records[-1]['name']!r}, images={len(new_records[-1]['images'])}")
print("DONE master")
