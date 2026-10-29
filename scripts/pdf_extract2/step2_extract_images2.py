"""Step 2 (batch 2): Extract all images from each new PDF, save to public/program-images/new2/.

Naming: new2_p{pdf_idx}_pg{page}_img{idx}.{ext}
We embed the page number so we can later map images back to programs.

Also detects blank/white images and skips them.
"""
import fitz
import os
import io
import json

try:
    from PIL import Image
    import numpy as np
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("[!] PIL/numpy not available, will not filter blank images")

PDFS = [
    (1, "/home/z/my-project/upload/اهدای عضو.pdf"),
    (2, "/home/z/my-project/upload/برنامه_های پلیسی.pdf"),
    (3, "/home/z/my-project/upload/برنامه_های مرتبط با قانون اساسی.PDF"),
    (4, "/home/z/my-project/upload/برنامه_های تلویزیونی - صرفه_جویی در مصرف انرژی.pdf"),
]

OUT_DIR = "/home/z/my-project/public/program-images/new2"
os.makedirs(OUT_DIR, exist_ok=True)

# Map: (pdf_idx, page) -> list of saved image filenames (relative path)
image_map = {}

# A "blank" image is one that is essentially uniform white (no content).
# Page-scan images of pages that contain text/photos have mean ~254 but std ~10,
# so we additionally require very low std to call something blank.
BLANK_MEAN_THRESHOLD = 240  # task spec: mean > 240 = blank/white
BLANK_STD_THRESHOLD = 5     # but only if also nearly uniform (std < 5)


def is_blank_image(img_bytes):
    """Returns True if image is blank/white (mean > 240 AND std < 5).

    Note: page-scan images of text pages have mean ~254 but std ~10 due to the
    text/figures; those are NOT considered blank because they still carry content.
    Truly blank images (e.g. scans of empty pages) have mean ~255 AND std < 5.
    """
    if not HAS_PIL:
        return False
    try:
        img = Image.open(io.BytesIO(img_bytes)).convert("L")
        arr = np.asarray(img)
        mean = float(arr.mean())
        std = float(arr.std())
        return mean > BLANK_MEAN_THRESHOLD and std < BLANK_STD_THRESHOLD
    except Exception:
        return False


total_saved = 0
total_skipped_blank = 0
total_skipped_tiny = 0
total_skipped_err = 0

for pdf_idx, path in PDFS:
    if not os.path.exists(path):
        print(f"[!] Missing: {path}")
        continue
    doc = fitz.open(path)
    saved_count = 0
    blank_count = 0
    tiny_count = 0
    err_count = 0
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
            if ext in ("jpg", "jpe", "jpeg"):
                ext = "jpeg"
            elif ext in ("png",):
                ext = "png"
            else:
                ext = "png"
            w = img[2]; h = img[3]
            # Skip tiny images (likely icons/logos)
            if w * h < 5000:
                tiny_count += 1
                continue
            try:
                base = doc.extract_image(xref)
                img_bytes = base["image"]
            except Exception:
                err_count += 1
                continue
            # Check for blank image
            if is_blank_image(img_bytes):
                blank_count += 1
                continue
            fname = f"new2_p{pdf_idx}_pg{pno}_img{i}.{ext}"
            fpath = os.path.join(OUT_DIR, fname)
            with open(fpath, "wb") as f:
                f.write(img_bytes)
            rel = f"/program-images/new2/{fname}"
            image_map.setdefault((pdf_idx, pno), []).append(rel)
            saved_count += 1
    doc.close()
    print(f"PDF {pdf_idx}: saved {saved_count} images, skipped blank={blank_count}, tiny={tiny_count}, err={err_count}")
    total_saved += saved_count
    total_skipped_blank += blank_count
    total_skipped_tiny += tiny_count
    total_skipped_err += err_count

# Save image_map
out_map = "/home/z/my-project/scripts/pdf_extract2/image_map.json"
with open(out_map, "w", encoding="utf-8") as f:
    json.dump({f"{k[0]}_{k[1]}": v for k, v in image_map.items()}, f, ensure_ascii=False, indent=1)
print(f"Saved image_map.json -> {out_map}")
print(f"Totals: saved={total_saved}, blank_skipped={total_skipped_blank}, tiny_skipped={total_skipped_tiny}, err_skipped={total_skipped_err}")
print("DONE step2")
