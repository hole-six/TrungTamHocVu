# PWA Icons

Các icons này được tự động generate từ logo gốc `public/img/logoTACH.png`.

## Generate lại icons

Nếu bạn cập nhật logo gốc và muốn generate lại tất cả PWA icons:

```bash
# Cài đặt Pillow nếu chưa có
pip install Pillow

# Chạy script generate
python scripts/generate-pwa-icons.py
```

## Các file được generate

- `favicon-32.png` - Favicon cho browser (32x32)
- `icon-192.png` - PWA icon standard (192x192)
- `icon-512.png` - PWA icon lớn (512x512)
- `icon-512-maskable.png` - PWA icon maskable với safe zone (512x512)
- `apple-touch-icon.png` - Icon cho iOS home screen (180x180)
- `badge-72.png` - Badge icon cho notifications (72x72)

## Maskable Icons

Icon maskable có padding 25% để đảm bảo logo không bị cắt khi OS apply mask tròn/vuông.

## Tham khảo

- [PWA Icons Guidelines](https://web.dev/add-manifest/)
- [Maskable Icons](https://maskable.app/)
