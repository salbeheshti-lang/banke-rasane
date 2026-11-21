#!/usr/bin/env python3
"""Generate a white monochrome (knockout) variant of the client logo.

Takes public/client-logo.png (navy, transparent background) and produces
public/client-logo-white.png: white fill, alpha modulated by original
luminance so the globe/detail texture survives subtly. Transparent bbox
is trimmed for tight layout usage.
"""
from PIL import Image
import numpy as np

SRC = 'public/client-logo.png'
DST = 'public/client-logo-white.png'

img = Image.open(SRC).convert('RGBA')
arr = np.array(img).astype(np.float32)

r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]

# Normalize luminance of visible pixels (0..1)
lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
max_lum = lum[a > 40].max() if (a > 40).any() else 1.0
lum_n = np.clip(lum / max(max_lum, 1e-6), 0, 1)

# White knockout: color = white everywhere, alpha = original alpha
# modulated so darker navy areas sit at ~72% opacity and lighter
# detail areas (globe continents) reach full opacity.
alpha_new = a * (0.72 + 0.28 * lum_n)

out = np.zeros_like(arr)
out[..., 0] = 255
out[..., 1] = 255
out[..., 2] = 255
out[..., 3] = alpha_new

res = Image.fromarray(out.astype(np.uint8), 'RGBA')

# Trim fully transparent margins with a small uniform pad
bbox = res.getchannel('A').getbbox()
if bbox:
    pad = 4
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(res.width, bbox[2] + pad)
    bottom = min(res.height, bbox[3] + pad)
    res = res.crop((left, top, right, bottom))

# Resize to a practical master size (~240px tall) for crisp UI scaling
target_h = 240
target_w = round(res.width * target_h / res.height)
res = res.resize((target_w, target_h), Image.LANCZOS)

res.save(DST, optimize=True)
print('saved', DST, res.size)

# sanity print
chk = Image.open(DST).convert('RGBA')
w, h = chk.size
print('corners:', [chk.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]])
alpha = np.array(chk.getchannel('A'))
print('transparent px: %.1f%%' % (100 * (alpha < 16).mean()))
