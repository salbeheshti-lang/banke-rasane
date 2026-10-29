"""Parse TOC of PDF 3 to extract program entries (English name, Persian name, printed page)."""
import json, re

with open('/home/z/my-project/scripts/pdf_extract/pdf3_toc.txt', 'r', encoding='utf-8') as f:
    raw = f.read()

# Strip page markers and dots
text = re.sub(r'=== page \d+ \(imgs=\d+\) ===', '', raw)
text = re.sub(r'\.{3,}', ' ', text)  # replace dot runs with space

# Now we have a stream of Persian/English text interleaved with page numbers.
# Strategy: split on digit-only lines (page numbers). Each block before a page number
# is the entry that maps to that page.

lines = [l.strip() for l in text.split('\n') if l.strip()]
# Identify which lines are pure page numbers (1-3 digits, possibly with spaces)
def is_pagenum(s):
    s = s.replace(' ', '')
    return s.isdigit() and 1 <= int(s) <= 240

entries = []
current_block = []
for l in lines:
    if is_pagenum(l):
        page_num = int(l.replace(' ', ''))
        if current_block:
            entries.append((page_num, ' '.join(current_block)))
            current_block = []
    else:
        current_block.append(l)
if current_block:
    entries.append((0, ' '.join(current_block)))

# Now filter: keep entries that look like programs (page_num > 4 and have a meaningful block)
programs = []
for pg, block in entries:
    if pg < 5:
        continue  # skip mokaddameh, fihrist entries
    block = block.strip()
    if not block or len(block) < 3:
        continue
    # Extract English name if there's a "-" separator and English text after
    # Also handle case where there's no English name (Persian-only entry)
    # Look for Latin-script words
    latin_match = re.findall(r'[A-Za-z][A-Za-z\s\&\'\!\?\,\-\.]+', block)
    # Persian name (everything before the dash and English)
    persian_part = block
    # If there's a "-" followed by Latin, split there
    m = re.search(r'\s*-\s*([A-Za-z][A-Za-z\s\&\'\!\?\,\-\.]+)\s*$', block)
    english = None
    if m:
        english = m.group(1).strip()
        persian_part = block[:m.start()].strip()
    elif latin_match:
        # Use longest latin match
        english = max(latin_match, key=len).strip()
        persian_part = block.replace(english, '').strip(' -')
    # Clean persian_part: remove leading dash, stray spaces
    persian_part = persian_part.strip(' -')
    programs.append({
        'page': pg,  # printed page number
        'pdf_index': pg - 1,  # PDF page index = printed page - 1 (per earlier observation)
        'english': english,
        'persian': persian_part,
        'raw': block,
    })

print(f'Extracted {len(programs)} candidate TOC entries')
for p in programs:
    print(f"  p{p['page']:3d} | EN: {p['english']!r:50s} | FA: {p['persian'][:40]}")

with open('/home/z/my-project/scripts/pdf_extract/pdf3_toc_entries.json', 'w', encoding='utf-8') as f:
    json.dump(programs, f, ensure_ascii=False, indent=2)
print('Saved pdf3_toc_entries.json')
