"""Step 1: Extract text + image inventory from each PDF, save as JSON."""
import fitz
import json
import os
import re

PDFS = [
    ("نقد فیلم", "/home/z/my-project/upload/برنامه_های نقد فیلم.pdf"),
    ("خانواده", "/home/z/my-project/upload/خانواده و افزایش جمعیت.pdf"),
    ("رمضان", "/home/z/my-project/upload/تحلیل برنامه_های مرتبط با ماه مبارک رمضان.pdf"),
    ("دوربین", "/home/z/my-project/upload/پخش زنده دوربین_ها.pdf"),
]

out_dir = "/home/z/my-project/scripts/pdf_extract"
os.makedirs(out_dir, exist_ok=True)

for idx, (label, path) in enumerate(PDFS, start=1):
    if not os.path.exists(path):
        print(f"[!] Missing: {path}")
        continue
    doc = fitz.open(path)
    pages = []
    total_imgs = 0
    for pno in range(len(doc)):
        page = doc.load_page(pno)
        text = page.get_text("text") or ""
        # image inventory on page: list of (xref, ext, width, height)
        imgs = []
        try:
            for img in page.get_images(full=True):
                xref = img[0]
                ext = img[1] if img[1] else "png"
                w = img[2]
                h = img[3]
                imgs.append({"xref": xref, "ext": ext, "w": w, "h": h})
        except Exception as e:
            pass
        total_imgs += len(imgs)
        pages.append({
            "pno": pno,
            "text": text,
            "images": imgs,
        })
    doc.close()
    out_path = os.path.join(out_dir, f"pdf{idx}_{label}_text.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"label": label, "path": path, "pages": pages, "total_images": total_imgs}, f, ensure_ascii=False, indent=1)
    print(f"PDF {idx} ({label}): {len(pages)} pages, {total_imgs} images -> {out_path}")
print("DONE step1")
