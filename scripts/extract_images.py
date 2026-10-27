#!/usr/bin/env python3
"""Extract all images from PDF and map them to programs"""
import fitz
import os
import json
import re

pdf_path = '/home/z/my-project/upload/دکور برنامه‌ها - کامل.pdf'
output_dir = '/home/z/my-project/public/program-images'
os.makedirs(output_dir, exist_ok=True)

# Load show data
with open('/home/z/my-project/public/talk-shows-data.json', 'r', encoding='utf-8') as f:
    shows = json.load(f)

doc = fitz.open(pdf_path)
print(f"PDF has {len(doc)} pages")

# Extract all text to find which page each program is on
program_pages = {}  # show_name -> list of page numbers

for page_num in range(len(doc)):
    page = doc[page_num]
    text = page.get_text()
    
    for show in shows:
        name = show['name']
        if name in text:
            if name not in program_pages:
                program_pages[name] = []
            program_pages[name].append(page_num)

print(f"Found page mappings for {len(program_pages)} programs")

# Extract images and map to programs
img_count = 0
program_images = {}  # show_name -> list of image paths

for page_num in range(len(doc)):
    page = doc[page_num]
    images = page.get_images(full=True)
    
    for img_idx, img in enumerate(images):
        xref = img[0]
        try:
            pix = fitz.Pixmap(doc, xref)
            if pix.n - pix.alpha >= 4:  # CMYK
                pix = fitz.Pixmap(fitz.csRGB, pix)
            
            img_name = f"p{page_num+1}_img{img_idx+1}.png"
            img_path = os.path.join(output_dir, img_name)
            pix.save(img_path)
            pix = None
            img_count += 1
            
            # Map to programs on this page
            for show_name, pages in program_pages.items():
                if page_num in pages:
                    if show_name not in program_images:
                        program_images[show_name] = []
                    program_images[show_name].append(f"/program-images/{img_name}")
        except Exception as e:
            pass

print(f"Extracted {img_count} total images")
print(f"Mapped images to {len(program_images)} programs")

# Update shows with image paths
updated = 0
for show in shows:
    if show['name'] in program_images and program_images[show['name']]:
        show['images'] = program_images[show['name']]
        updated += 1

print(f"Updated {updated} shows with images")

# Save
with open('/home/z/my-project/public/talk-shows-data.json', 'w', encoding='utf-8') as f:
    json.dump(shows, f, ensure_ascii=False, indent=2)

# Print samples
for s in shows[:3]:
    imgs = s.get('images', [])
    print(f"\n{s['name']}: {len(imgs)} images")
    for img in imgs[:2]:
        print(f"  {img}")
