#!/usr/bin/env python3
"""Extract show descriptions from the PDF text and update the JSON data"""
import json
import re
import subprocess

# Extract PDF text
result = subprocess.run(
    ['pdftotext', '/home/z/my-project/upload/دکور برنامه\u200cها - کامل.pdf', '-'],
    capture_output=True, text=True
)
pdf_text = result.stdout

# Clean up the text - remove special chars
pdf_text = pdf_text.replace('\u202c', '').replace('\u202b', '').replace('\u200e', '').replace('\u200f', '')
pdf_text = pdf_text.replace('\u200c', '')  # ZWNJ

# Load existing data
with open('/home/z/my-project/public/talk-shows-data.json', 'r', encoding='utf-8') as f:
    shows = json.load(f)

# Parse show descriptions from PDF
# Pattern: number) Show Name followed by description text
# The PDF has patterns like "1) Ayuready?" or "Ayuready? )1"

# First, let's find all show entries by looking for show names
updated_count = 0

for show in shows:
    show_name = show['name']
    # Try to find the show name in the PDF text
    # The name might be slightly different, so try partial match
    name_escaped = re.escape(show_name)
    
    # Search for the show name followed by description
    # Pattern: show name ... until next show or end
    pattern = rf'{name_escaped}.*?(?=\d+\)\s*[A-Z]|\Z)'
    match = re.search(pattern, pdf_text, re.DOTALL | re.IGNORECASE)
    
    if match:
        desc_text = match.group(0)
        # Clean up
        desc_text = desc_text.replace(show_name, '').strip()
        # Take first 500 chars as description
        desc_text = desc_text[:500].strip()
        
        if len(desc_text) > 50:  # Only update if we got meaningful text
            show['summary'] = desc_text
            # Also update descriptionFa with the real Persian description from PDF
            show['descriptionFa'] = desc_text[:300]
            updated_count += 1

print(f'Updated {updated_count} shows out of {len(shows)}')

# Save
with open('/home/z/my-project/public/talk-shows-data.json', 'w', encoding='utf-8') as f:
    json.dump(shows, f, ensure_ascii=False, indent=2)

# Print sample
print('\nSample (first show):')
print(f"Name: {shows[0]['name']}")
print(f"Description: {shows[0].get('descriptionFa', 'N/A')[:200]}")
