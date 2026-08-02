// Sinh lại bộ icon PWA trong public/pwa-icons/ — chạy: node scripts/generate_pwa_icons.js
//
// Dùng bộ mã hóa PNG viết tay bằng zlib có sẵn trong Node thay vì next/og
// (ImageResponse): next/og trên máy Windows đang bị lỗi resolve đường dẫn font mặc
// định (bug bundler của Next 14.2.35, ném "Invalid URL" ngay khi import) nên không
// dùng được để render icon. Cách này không phụ thuộc gói ngoài (sharp/canvas không
// có sẵn trong dự án).
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ORANGE = [0xf9, 0x73, 0x16]; // #F97316 — primary.DEFAULT trong tailwind.config
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idatData), chunk("IEND", Buffer.alloc(0))]);
}

// Vẽ nền vuông (bo góc tùy chọn) + chữ "T" khối ở giữa — monogram tối giản, không cần
// font để tránh đúng bug ở trên; đủ để dùng làm icon PWA/favicon mặc định.
function renderIcon({ size, rounded, safeZoneRatio }) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = rounded ? size * 0.22 : 0;

  function insideRoundedSquare(x, y) {
    if (radius <= 0) return true;
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  }

  const inset = size * safeZoneRatio;
  const glyphLeft = inset;
  const glyphRight = size - inset;
  const glyphTop = inset;
  const glyphBottom = size - inset;
  const glyphWidth = glyphRight - glyphLeft;
  const glyphHeight = glyphBottom - glyphTop;
  const barHeight = glyphHeight * 0.22;
  const stemWidth = glyphWidth * 0.34;
  const stemLeft = glyphLeft + (glyphWidth - stemWidth) / 2;
  const stemRight = stemLeft + stemWidth;

  function isGlyph(x, y) {
    const inBar = x >= glyphLeft && x < glyphRight && y >= glyphTop && y < glyphTop + barHeight;
    const inStem = x >= stemLeft && x < stemRight && y >= glyphTop && y < glyphBottom;
    return inBar || inStem;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const opaque = insideRoundedSquare(x + 0.5, y + 0.5);
      const color = isGlyph(x + 0.5, y + 0.5) ? WHITE : ORANGE;
      rgba[idx] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = opaque ? 255 : 0;
    }
  }

  return encodePng(size, size, rgba);
}

const outDir = path.join(__dirname, "..", "public", "pwa-icons");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { file: "favicon-32.png", size: 32, rounded: true, safeZoneRatio: 0.2 },
  { file: "apple-touch-icon.png", size: 180, rounded: true, safeZoneRatio: 0.22 },
  { file: "icon-192.png", size: 192, rounded: true, safeZoneRatio: 0.22 },
  { file: "icon-512.png", size: 512, rounded: true, safeZoneRatio: 0.22 },
  { file: "icon-512-maskable.png", size: 512, rounded: false, safeZoneRatio: 0.32 },
  { file: "badge-72.png", size: 72, rounded: true, safeZoneRatio: 0.22 },
];

for (const target of targets) {
  const png = renderIcon(target);
  fs.writeFileSync(path.join(outDir, target.file), png);
  console.log("wrote", target.file, png.length, "bytes");
}
