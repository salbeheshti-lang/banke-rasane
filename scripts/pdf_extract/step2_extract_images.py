"""Step 2: Extract all images from each PDF, save to public/program-images/new/.

Naming: new_p{pdf_idx}_pg{page}_img{idx}.{ext}
We embed the page number so we can later map images back to programs.
"""
import fitz
import os
import json

PDFS = [
    (1, "/home/z/my-project/upload/برنامه_های نقد فیلم.pdf"),
    (2, "/home/z/my-project/upload/خانواده و افزایش جمعیت.pdf"),
    (3, "/home/z/my-project/upload/تحلیل برنامه_های مرتبط با ماه مبارک رمضان.pdf"),
    (4, "/home/z/my-project/upload/پخش زنده دوربین_ها.pdf"),
]

OUT_DIR = "/home/z/my-project/public/program-images/new"
os.makedirs(OUT_DIR, exist_ok=True)

# Map: (pdf_idx, page) -> list of saved image filenames (relative path)
image_map = {}

for pdf_idx, path in PDFS:
    if not os.path.exists(path):
        print(f"[!] Missing: {path}")
        continue
    doc = fitz.open(path)
    saved_count = 0
    for pno in range(len(doc)):
        page = doc.load_page(pno)
        try:
            imgs = page.get_images(full=True)
        except Exception:
            imgs = []
        for i, img in enumerate(imgs):
            xref = img[0]
            ext_raw = img[1]
            ext = ext_raw.lower() if isinstance(ext_raw, str) and ext_raw else "png"
            # Normalize extension
            if ext in ("jpg", "jpe", "jpeg"):
                ext = "jpeg"
            elif ext in ("png",):
                ext = "png"
            else:
                ext = "png"
            # Skip tiny images (likely icons/logos, < 5KB roughly / w*h < 5000)
            w = img[2]; h = img[3]
            if w * h < 5000:
                continue
            fname = f"new_p{pdf_idx}_pg{pno}_img{i}.{ext}"
            fpath = os.path.join(OUT_DIR, fname)
            try:
                base = doc.extract_image(xref)
                img_bytes = base["image"]
                with open(fpath, "wb") as f:
                    f.write(img_bytes)
                rel = f"/program-images/new/{fname}"
                image_map.setdefault((pdf_idx, pno), []).append(rel)
                saved_count += 1
            except Exception as e:
                print(f"  ! err p{pdf_idx} pg{pno} img{i}: {e}")
    doc.close()
    print(f"PDF {pdf_idx}: saved {saved_count} images")

# Save image_map
with open("/home/z/my-project/scripts/pdf_extract/image_map.json", "w", encoding="utf-8") as f:
    json.dump({f"{k[0]}_{k[1]}": v for k, v in image_map.items()}, f, ensure_ascii=False, indent=1)
print("Saved image_map.json")
print("DONE step2")
