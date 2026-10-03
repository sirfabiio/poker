// Gera os ícones PNG da PWA (ficha dourada sobre feltro verde) sem dependências: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const FELT_700 = hex("#0B3B2C"), FELT_900 = hex("#06231A"), GOLD = hex("#D4AF37"), GOLD_DARK = hex("#9C7E22"), IVORY = hex("#F5F1E6"), INK = hex("#0A0D0C");

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const inTri = (px, py, a, b, c) => {
  const s = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = s([px, py], a, b), d2 = s([px, py], b, c), d3 = s([px, py], c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

/** Cor num ponto (u,v) normalizado em [-1,1] relativo ao centro do ícone; chipR = raio da ficha. */
function sample(u, v, chipR) {
  const d = Math.hypot(u, v);
  const bgT = Math.min(1, Math.hypot(u, v + 0.6) / 1.6);
  const bg = FELT_700.map((c, i) => Math.round(c + (FELT_900[i] - c) * bgT));
  if (d > chipR) return bg;
  const r = d / chipR;
  if (r > 0.76) {
    const ang = (Math.atan2(v, u) + Math.PI) / (2 * Math.PI);
    return Math.floor(ang * 16) % 2 === 0 ? IVORY : GOLD;
  }
  if (r > 0.7) return GOLD_DARK;
  // naipe de espadas ao centro
  const x = u / chipR / 0.5, y = v / chipR / 0.5;
  const spade =
    Math.hypot(x + 0.36, y - 0.12) < 0.36 ||
    Math.hypot(x - 0.36, y - 0.12) < 0.36 ||
    inTri(x, y, [0, -0.78], [-0.69, 0.02], [0.69, 0.02]) ||
    inTri(x, y, [0, -0.2], [-0.26, 0.7], [0.26, 0.7]);
  return spade ? INK : GOLD;
}

function render(size, chipR) {
  const SS = 4;
  return png(size, (px, py) => {
    const acc = [0, 0, 0];
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) {
        const u = ((px + (sx + 0.5) / SS) / size) * 2 - 1;
        const v = ((py + (sy + 0.5) / SS) / size) * 2 - 1;
        const c = sample(u, v, chipR);
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      }
    return acc.map((c) => Math.round(c / (SS * SS)));
  });
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", render(192, 0.8));
writeFileSync("public/icons/icon-512.png", render(512, 0.8));
// maskable: a ficha fica dentro da zona segura (círculo de 80%)
writeFileSync("public/icons/icon-maskable-512.png", render(512, 0.62));
writeFileSync("public/icons/apple-touch-icon.png", render(180, 0.74));
console.log("Ícones gerados em public/icons/");
