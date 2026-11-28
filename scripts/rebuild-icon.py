#!/usr/bin/env python3
"""
Rebuild the BankResaneh application icon with an emerald background.

Design:
  - Square 1024×1024 canvas (Windows / macOS icon standard)
  - Emerald gradient background (emerald-600 → emerald-900, diagonal)
  - Drop shadow under the logo so the green filmstrip stands out
  - The filmstrip symbol (cropped from the source logo, ~square) is scaled
    to ~70% of the canvas and centered — much larger than the previous
    transparent icon that left Windows to render the logo on its default
    background.

Outputs:
  - electron/icon.png         (1024×1024 master)
  - electron/icon.ico         (multi-size: 16,32,48,64,128,256)
  - public/icons/icon-{16,32,64,128,256}.png
  - public/favicon.ico        (multi-size: 16,32)
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# IMPORTANT: read from logo.png (the untouched 1671×941 source).
# Never read from icon.png — that's the generated output and would cause
# feedback where each iteration crops the previous iteration's output.
SRC_LOGO = os.path.join(ROOT, 'electron', 'logo.png')

# ---- Source crop: the filmstrip symbol only ----
# Discovered via row/column density analysis of the source logo.
# The source logo (1671×941) contains, top-to-bottom:
#   - filmstrip symbol at y≈68..483, x≈668..1044  (≈square, ~376×415)
#   - wordmark "بانک رسانه" at y≈569..782          (very wide, unusable for icon)
#   - tagline at y≈810..875                         (too small to be legible at 16px)
CROP = (660, 60, 1052, 492)   # left, upper, right, lower  (with small padding)

# ---- Canvas ----
CANVAS = 1024
# Logo target height as a fraction of the canvas.
# 0.58 leaves ~21% margin top and bottom — enough room for the white outline
# and the soft glow so the symbol never visually touches the canvas edge.
LOGO_HEIGHT_FRAC = 0.58

# ---- Emerald palette (Tailwind) ----
# Darkened to give the green filmstrip symbol enough figure-ground contrast.
EMERALD_900 = (6, 78, 59)       # #064e3b  (top-left)
EMERALD_950 = (2, 44, 34)      # #022c22  (bottom-right)


def emerald_gradient(size):
    """Diagonal gradient from EMERALD_900 (top-left) to EMERALD_950 (bottom-right)."""
    w = h = size
    xs = np.linspace(0.0, 1.0, w, dtype=np.float32)
    ys = np.linspace(0.0, 1.0, h, dtype=np.float32)
    X, Y = np.meshgrid(xs, ys)
    t = (X + Y) * 0.5
    r = (EMERALD_900[0] + (EMERALD_950[0] - EMERALD_900[0]) * t).astype(np.uint8)
    g = (EMERALD_900[1] + (EMERALD_950[1] - EMERALD_900[1]) * t).astype(np.uint8)
    b = (EMERALD_900[2] + (EMERALD_950[2] - EMERALD_900[2]) * t).astype(np.uint8)
    a = np.full((h, w), 255, dtype=np.uint8)
    rgba = np.stack([r, g, b, a], axis=-1)
    return Image.fromarray(rgba)


def make_outer_glow(logo_rgba, color=(180, 255, 220), blur=30, opacity=90, pad=None):
    """Soft light halo around the logo shape to lift it off the dark background."""
    if pad is None:
        pad = blur * 2
    alpha = logo_rgba.split()[-1]
    glow_w, glow_h = logo_rgba.size[0] + pad * 2, logo_rgba.size[1] + pad * 2
    glow = Image.new('RGBA', (glow_w, glow_h), (0, 0, 0, 0))
    colored = Image.new('RGBA', logo_rgba.size, color + (opacity,))
    glow.paste(colored, (pad, pad), mask=alpha)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=blur))
    return glow, pad


def make_outline(logo_rgba, color=(255, 255, 255), width=4, opacity=210):
    """Thin white ring around the logo shape to guarantee figure-ground contrast
    even when the symbol and background are both green. Returned image is the
    same size as logo_rgba, with the ring alpha = dilated_alpha - original_alpha.
    A light blur is applied to the ring so the MaxFilter block edges don't show."""
    alpha = logo_rgba.split()[-1]
    dilated = alpha.filter(ImageFilter.MaxFilter(size=width * 2 + 1))
    import numpy as _np
    d = _np.array(dilated, dtype=_np.int16)
    a = _np.array(alpha, dtype=_np.int16)
    ring_alpha = _np.clip(d - a, 0, 255).astype(_np.uint8)
    outline = Image.new('RGBA', logo_rgba.size, color + (opacity,))
    outline.putalpha(Image.fromarray(ring_alpha))
    # Soften the ring's outer edge so the MaxFilter block steps don't read as
    # a rectangular halo (flagged by VLM in earlier iterations).
    outline = outline.filter(ImageFilter.GaussianBlur(radius=1.2))
    return outline


def make_drop_shadow(logo_rgba, blur=22, opacity=170, offset=(0, 16)):
    """Return a RGBA shadow image the same size as logo_rgba."""
    # Use the alpha channel as the shadow shape.
    alpha = logo_rgba.split()[-1]
    shadow = Image.new('RGBA', logo_rgba.size, (0, 0, 0, 0))
    # Paint black where the logo is opaque.
    black = Image.new('RGBA', logo_rgba.size, (0, 0, 0, opacity))
    shadow.paste(black, mask=alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=blur))
    if offset != (0, 0):
        canvas = Image.new('RGBA', logo_rgba.size, (0, 0, 0, 0))
        canvas.paste(shadow, offset, shadow)
        shadow = canvas
    return shadow


def build_icon():
    if not os.path.exists(SRC_LOGO):
        sys.exit('Source logo not found: ' + SRC_LOGO)
    src = Image.open(SRC_LOGO).convert('RGBA')
    # Crop the filmstrip symbol.
    strip = src.crop(CROP)
    # Trim any residual transparent margin so the symbol is tight.
    bbox = strip.getbbox()
    if bbox:
        strip = strip.crop(bbox)

    # Background gradient.
    canvas = emerald_gradient(CANVAS)

    # Scale the symbol to LOGO_HEIGHT_FRAC of the canvas, preserving aspect.
    target_h = int(CANVAS * LOGO_HEIGHT_FRAC)
    sw, sh = strip.size
    scale = target_h / sh
    target_w = int(sw * scale)
    strip_scaled = strip.resize((target_w, target_h), Image.LANCZOS)

    # White outline ring — the decisive contrast fix. Wide enough that it
    # still reads at 16×16. This is what actually separates the green symbol
    # from the green background. (Previous iterations added an outer glow
    # built on a padded rectangle; that produced a visible rectangular halo
    # artifact, so it was removed in favor of the outline alone.)
    outline = make_outline(strip_scaled, color=(255, 255, 255), width=7, opacity=250)
    outline_pos = ((CANVAS - outline.size[0]) // 2, (CANVAS - outline.size[1]) // 2)
    canvas.alpha_composite(outline, outline_pos)

    # Paste the symbol centered.
    pos = ((CANVAS - target_w) // 2, (CANVAS - target_h) // 2)
    canvas.alpha_composite(strip_scaled, pos)

    return canvas


def save_outputs(canvas):
    out = {
        'electron/icon.png': ('PNG', None, (1024, 1024)),
        'electron/icon.ico': ('ICO', [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)], None),
        'public/icons/icon-256.png': ('PNG', None, (256, 256)),
        'public/icons/icon-128.png': ('PNG', None, (128, 128)),
        'public/icons/icon-64.png': ('PNG', None, (64, 64)),
        'public/icons/icon-32.png': ('PNG', None, (32, 32)),
        'public/icons/icon-16.png': ('PNG', None, (16, 16)),
        'public/favicon.ico': ('ICO', [(16, 16), (32, 32)], None),
    }
    for rel, (fmt, sizes, force_size) in out.items():
        path = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        img = canvas
        if force_size:
            img = canvas.resize(force_size, Image.LANCZOS)
        if fmt == 'ICO':
            img.save(path, format='ICO', sizes=sizes)
        else:
            img.save(path, format='PNG')
        print('  saved ' + rel)


if __name__ == '__main__':
    print('Building new icon (emerald background, larger filmstrip)...')
    canvas = build_icon()
    save_outputs(canvas)
    print('Done.')
