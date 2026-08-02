#!/usr/bin/env python3
"""
Generate PWA icons from logoTACH.png
Requires: pip install Pillow
"""

from PIL import Image
import os

# Paths
input_logo = "public/img/logoTACH.png"
output_dir = "public/pwa-icons"

# Icon sizes to generate
sizes = [
    ("favicon-32.png", 32, False),
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("icon-512-maskable.png", 512, True),
    ("apple-touch-icon.png", 180, False),
    ("badge-72.png", 72, False),
]

def generate_icons():
    """Generate all PWA icons from source logo"""
    
    # Check if input exists
    if not os.path.exists(input_logo):
        print(f"❌ Error: {input_logo} not found!")
        return
    
    # Create output directory if needed
    os.makedirs(output_dir, exist_ok=True)
    
    # Load source image
    print(f"📷 Loading source logo: {input_logo}")
    source = Image.open(input_logo)
    
    # Convert to RGBA if needed
    if source.mode != "RGBA":
        source = source.convert("RGBA")
    
    print(f"   Original size: {source.size}")
    print()
    
    # Generate each size
    for filename, size, is_maskable in sizes:
        output_path = os.path.join(output_dir, filename)
        
        if is_maskable:
            # Maskable icons need padding (safe zone: 80% of icon)
            # Create canvas with padding
            canvas_size = size
            logo_size = int(size * 0.75)  # 75% to leave safe zone
            
            # Create white background
            canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 255))
            
            # Resize logo
            resized = source.copy()
            resized.thumbnail((logo_size, logo_size), Image.Resampling.LANCZOS)
            
            # Center logo on canvas
            x = (canvas_size - resized.size[0]) // 2
            y = (canvas_size - resized.size[1]) // 2
            canvas.paste(resized, (x, y), resized)
            
            # Save
            canvas.save(output_path, "PNG", optimize=True)
            print(f"✅ Generated {filename} ({size}x{size}) [maskable with padding]")
        else:
            # Regular icons - just resize
            resized = source.copy()
            resized.thumbnail((size, size), Image.Resampling.LANCZOS)
            
            # Create canvas to center if needed
            if resized.size[0] != size or resized.size[1] != size:
                canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
                x = (size - resized.size[0]) // 2
                y = (size - resized.size[1]) // 2
                canvas.paste(resized, (x, y), resized)
                canvas.save(output_path, "PNG", optimize=True)
            else:
                resized.save(output_path, "PNG", optimize=True)
            
            print(f"✅ Generated {filename} ({size}x{size})")
    
    print()
    print("🎉 All PWA icons generated successfully!")
    print(f"   Output directory: {output_dir}")

if __name__ == "__main__":
    generate_icons()
