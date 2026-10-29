#!/usr/bin/env python3
"""Generate proper Windows ICO file with multiple sizes (min 256x256 for electron-builder)"""
import os
import cairosvg
from PIL import Image
import io

ICON_DIR = '/home/z/my-project/workspace/new_repo/build'
SVG_PATH = os.path.join(ICON_DIR, 'icon.svg')

# Generate PNGs at various sizes
sizes = [16, 32, 48, 64, 128, 256, 512, 1024]
png_data = {}

print('Generating PNG files...')
for size in sizes:
    png_bytes = cairosvg.svg2png(
        url=SVG_PATH,
        output_width=size,
        output_height=size,
    )
    png_data[size] = png_bytes
    
    output_path = os.path.join(ICON_DIR, f'icon-{size}.png')
    with open(output_path, 'wb') as f:
        f.write(png_bytes)
    print(f'  Generated {output_path}')

# Save main icon.png (256x256 - meets electron-builder minimum)
with open(os.path.join(ICON_DIR, 'icon.png'), 'wb') as f:
    f.write(png_data[256])
print(f'Generated {ICON_DIR}/icon.png (256x256)')

# Generate ICO file with multiple sizes (Windows requires 256x256 for modern apps)
# Per Microsoft spec, ICO should contain: 16, 32, 48, 64, 128, 256
ico_sizes = [16, 32, 48, 64, 128, 256]
images = []
for size in ico_sizes:
    img = Image.open(io.BytesIO(png_data[size]))
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    images.append(img)

# Save as ICO with all sizes - this is critical for electron-builder
ico_path = os.path.join(ICON_DIR, 'icon.ico')
# Use the largest image as the base and append the others
images[-1].save(  # Use 256x256 as base
    ico_path,
    format='ICO',
    sizes=[(s, s) for s in ico_sizes],  # This tells PIL to include all sizes
)
print(f'Generated {ico_path} with sizes: {ico_sizes}')

# Verify
verify = Image.open(ico_path)
print(f'Verification - ICO size: {verify.size}, sizes: {verify.ico.sizes() if hasattr(verify, "ico") else "N/A"}')

# Also generate public icons
public_dir = '/home/z/my-project/workspace/new_repo/public/icons'
os.makedirs(public_dir, exist_ok=True)
for size in [16, 32, 64, 128, 256]:
    with open(os.path.join(public_dir, f'icon-{size}.png'), 'wb') as f:
        f.write(png_data[size])

# Favicon
favicon_path = os.path.join(public_dir, 'favicon.ico')
images[1].save(  # 32x32 as base
    favicon_path,
    format='ICO',
    sizes=[(16, 16), (32, 32), (48, 48)],
)
print(f'Generated {favicon_path}')

print('\n✅ All icons generated successfully!')
print(f'   ICO contains sizes: {ico_sizes}')
print(f'   Largest size: 256x256 (meets electron-builder requirement)')
