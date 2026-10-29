"""Step 1 (batch 2): Extract text + image inventory from each new PDF, save as JSON.

PDFs:
  1. اهدای عضو.pdf                 -> label: ads            (Organ donation / advertisements)
  2. برنامه_های پلیسی.pdf          -> label: police
  3. برنامه_های مرتبط با قانون اساسی.PDF -> label: constitution
  4. برنامه_های تلویزیونی - صرفه_جویی در مصرف انرژی.pdf -> label: energy-saving
"""
import fitz
import json
import os

PDFS = [
    ("ads",            "/home/z/my-project/upload/اهدای عضو.pdf"),
    ("police",         "/home/z/my-project/upload/برنامه_های پلیسی.pdf"),
    ("constitution",   "/home/z/my-project/upload/برنامه_های مرتبط با قانون اساسی.PDF"),
    ("energy-saving",  "/home/z/my-project/upload/برنامه_های تلویزیونی - صرفه_جویی در مصرف انرژی.pdf"),
]

out_dir = "/home/z/my-project/scripts/pdf_extract2"
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
        imgs = []
        try:
            for img in page.get_images(full=True):
                xref = img[0]
                ext = img[1] if img[1] else "png"
                w = img[2]
                h = img[3]
                imgs.append({"xref": xref, "ext": ext, "w": w, "h": h})
        except Exception:
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
