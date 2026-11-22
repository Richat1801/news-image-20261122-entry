// The World on Sunday 22 November 2026 — six-panel editorial infographic.
// Fully procedural: own PNG encoder (node:zlib + CRC32), float framebuffer,
// own 5x7 bitmap font. Node 22 stdlib only, no network, deterministic.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;
const fb = new Float32Array(W * H * 3);

type RGB = [number, number, number];

// ---------- low-level drawing ----------
function setPx(x: number, y: number, c: RGB): void {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
  const i = (yi * W + xi) * 3;
  fb[i] = c[0];
  fb[i + 1] = c[1];
  fb[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      fb[i] = c[0];
      fb[i + 1] = c[1];
      fb[i + 2] = c[2];
    }
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) setPx(x, y, c);
    }
  }
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB, w = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    const half = Math.floor(w / 2);
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) {
        setPx(px + ox, py + oy, c);
      }
    }
  }
}

function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((x - x0) * (y2 - y0) - (y - y0) * (x2 - x0)) / d;
      const b = ((x - x1) * (y0 - y1) - (y - y1) * (x0 - x1)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) setPx(x, y, c);
    }
  }
}

// Vertical gradient fill of a rectangle.
function vgrad(x: number, y: number, w: number, h: number, top: RGB, bottom: RGB): void {
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : yy / (h - 1);
    const c: RGB = [
      top[0] + (bottom[0] - top[0]) * t,
      top[1] + (bottom[1] - top[1]) * t,
      top[2] + (bottom[2] - top[2]) * t,
    ];
    fillRect(x, y + yy, w, 1, c);
  }
}

// ---------- 5x7 bitmap font (uppercase, digits, punctuation) ----------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
};

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * (5 * scale + 1) - 1;
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      const row = glyph[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "1") {
          fillRect(cx + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += 5 * scale + 1;
  }
}

function drawCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

// ---------- PNG encoding ----------
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    for (let x = 0; x < W; x++) {
      const fi = (y * W + x) * 3;
      const ri = y * (1 + W * 3) + 1 + x * 3;
      raw[ri] = Math.max(0, Math.min(255, Math.round(fb[fi])));
      raw[ri + 1] = Math.max(0, Math.min(255, Math.round(fb[fi + 1])));
      raw[ri + 2] = Math.max(0, Math.min(255, Math.round(fb[fi + 2])));
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- palette ----------
const NAVY: RGB = [15, 42, 74];
const NAVY_DARK: RGB = [9, 26, 48];
const GOLD: RGB = [255, 211, 77];
const WHITE: RGB = [255, 255, 255];
const INK: RGB = [20, 24, 32];
const PAPER: RGB = [250, 248, 242];

// Panel geometry: 2 cols x 3 rows, 496x274 each, 16px gaps, 8px outer margin.
const PW = 496;
const PH = 274;
const PX = [8, 512];
const PY = [108, 398, 688];
const SCENE_H = 188;
const LABEL_H = PH - SCENE_H;

function panelBg(px: number, py: number, top: RGB, bottom: RGB): void {
  vgrad(px, py, PW, SCENE_H, top, bottom);
  fillRect(px, py + SCENE_H, PW, LABEL_H, NAVY_DARK);
}

function panelLabels(px: number, py: number, title: string, sub: string): void {
  const cy = px + PW / 2;
  drawCentered(cy, py + SCENE_H + 14, title, 3, WHITE);
  drawCentered(cy, py + SCENE_H + 52, sub, 2, GOLD);
}

// ---------- scene 1: Russia's overnight attack on Ukraine ----------
function sceneAttack(px: number, py: number): void {
  panelBg(px, py, [11, 30, 58], [24, 52, 96]);
  // crescent moon
  disc(px + 430, py + 34, 18, [240, 238, 210]);
  disc(px + 438, py + 30, 16, [11, 30, 58]);
  // city skyline
  const skyline: Array<[number, number, number]> = [
    [0, 118, 64], [58, 96, 44], [98, 128, 52], [146, 88, 40],
    [182, 122, 58], [236, 96, 46], [278, 132, 60], [334, 104, 48], [378, 124, 56], [430, 100, 66],
  ];
  for (const [bx, bh, bw] of skyline) {
    fillRect(px + bx, py + SCENE_H - bh, bw, bh, [16, 22, 38]);
  }
  // lit windows
  const win: RGB = [255, 214, 110];
  const winPos: Array<[number, number]> = [
    [14, 96], [30, 78], [70, 108], [112, 82], [128, 104], [160, 118], [196, 92],
    [250, 108], [292, 86], [348, 112], [392, 96], [444, 110], [90, 122], [320, 128], [210, 126],
  ];
  for (const [wx, wy] of winPos) fillRect(px + wx, py + wy, 5, 7, win);
  // explosion bursts
  const burst = (cx: number, cy: number, r: number) => {
    disc(cx, cy, r, [255, 90, 20]);
    disc(cx, cy, Math.floor(r * 0.65), [255, 170, 40]);
    disc(cx, cy, Math.floor(r * 0.35), [255, 230, 120]);
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4 + 0.35;
      line(cx, cy, cx + Math.cos(ang) * (r + 14), cy + Math.sin(ang) * (r + 14), [255, 140, 40], 3);
    }
  };
  burst(px + 130, py + 66, 26);
  burst(px + 350, py + 52, 22);
  // smoke
  disc(px + 130, py + 30, 16, [90, 95, 110]);
  disc(px + 150, py + 22, 12, [110, 115, 130]);
  disc(px + 350, py + 22, 14, [90, 95, 110]);
  // missile trails (dotted arcs)
  for (let t = 0; t <= 10; t++) {
    const x = px + 210 + t * 8;
    const y = py + 150 - t * t * 0.9;
    disc(x, y, 2, [255, 255, 255]);
  }
  for (let t = 0; t <= 8; t++) {
    const x = px + 60 + t * 7;
    const y = py + 140 - t * t * 0.7;
    disc(x, y, 2, [255, 220, 150]);
  }
}

// ---------- scene 2: Hong Kong votes ----------
function sceneVote(px: number, py: number): void {
  panelBg(px, py, [168, 214, 232], [226, 242, 248]);
  // skyline towers
  const towers: Array<[number, number, number, RGB]> = [
    [20, 120, 46, [70, 110, 140]], [70, 92, 40, [90, 130, 160]],
    [114, 140, 44, [60, 100, 130]], [162, 84, 36, [100, 140, 168]],
    [330, 128, 44, [70, 110, 140]], [378, 96, 40, [90, 130, 160]],
    [422, 136, 46, [60, 100, 130]],
  ];
  for (const [bx, bh, bw, c] of towers) {
    fillRect(px + bx, py + SCENE_H - bh, bw, bh, c);
    // windows
    for (let wy = py + SCENE_H - bh + 8; wy < py + SCENE_H - 8; wy += 14) {
      for (let wx = px + bx + 6; wx < px + bx + bw - 6; wx += 12) {
        fillRect(wx, wy, 5, 6, [220, 235, 245]);
      }
    }
  }
  // spire on the tall tower
  line(px + 136, py + SCENE_H - 140, px + 136, py + SCENE_H - 168, [60, 100, 130], 3);
  // ballot box, centre foreground
  const bx = px + 198;
  const by = py + 96;
  fillRect(bx, by, 100, 84, [255, 255, 255]);
  fillRect(bx, by, 100, 10, [200, 40, 40]);
  fillRect(bx + 20, by + 4, 60, 4, [90, 20, 20]);
  // ballot paper rising from the slot, with a red tick
  fillRect(bx + 26, by - 34, 48, 40, [255, 255, 255]);
  line(bx + 26, by - 34, bx + 74, by - 34, INK, 2);
  line(bx + 34, by - 14, bx + 44, by - 4, [200, 40, 40], 4);
  line(bx + 44, by - 4, bx + 66, by - 28, [200, 40, 40], 4);
  // ground line
  fillRect(px, py + SCENE_H - 6, PW, 6, [70, 110, 140]);
}

// ---------- scene 3: India's record in Wellington ----------
function sceneCricket(px: number, py: number): void {
  panelBg(px, py, [46, 139, 87], [24, 96, 56]);
  // outfield mowing stripes
  for (let i = 0; i < 6; i++) {
    fillRect(px + i * 84, py, 42, SCENE_H, [52, 148, 94]);
  }
  // pitch
  fillRect(px + 168, py + 20, 160, SCENE_H - 20, [214, 186, 138]);
  // stumps at both ends
  const stumps = (sx: number, sy: number) => {
    for (let k = 0; k < 3; k++) fillRect(sx + k * 8, sy, 4, 26, [255, 220, 60]);
    fillRect(sx - 2, sy - 4, 28, 4, [255, 220, 60]);
  };
  stumps(px + 232, py + 34);
  stumps(px + 232, py + 142);
  // batsman: head, body, legs, bat
  const bx = px + 300;
  disc(bx, py + 78, 13, [240, 200, 160]); // head
  fillRect(bx - 12, py + 63, 24, 6, [20, 40, 90]); // cap crown on top of the head
  fillRect(bx + 6, py + 68, 12, 3, [20, 40, 90]); // cap brim, forward only
  line(bx, py + 92, bx + 6, py + 128, [255, 255, 255], 7); // torso (white kit)
  line(bx + 6, py + 128, bx - 8, py + 162, [255, 255, 255], 6); // front leg
  line(bx + 6, py + 128, bx + 20, py + 160, [255, 255, 255], 6); // back leg
  // arms + bat driving forward
  line(bx + 2, py + 100, bx + 34, py + 118, [240, 200, 160], 5);
  line(bx + 34, py + 118, bx + 64, py + 140, [170, 120, 60], 9);
  // red ball just struck off the bat
  disc(bx + 72, py + 144, 8, [200, 30, 30]);
  disc(bx + 70, py + 142, 3, [255, 120, 120]);
  // fielder in the distance
  disc(px + 90, py + 60, 9, [30, 60, 120]);
  line(px + 90, py + 69, px + 90, py + 96, [30, 60, 120], 6);
  line(px + 90, py + 96, px + 84, py + 118, [30, 60, 120], 5);
  line(px + 90, py + 96, px + 96, py + 118, [30, 60, 120], 5);
  // boundary rope
  for (let t = 0; t <= 40; t++) {
    const x = px + 20 + t * 12;
    const y = py + 176 - Math.sin((t / 40) * Math.PI) * 8;
    disc(x, y, 2, WHITE);
  }
}

// ---------- scene 4: COP31 talks deadlocked ----------
function sceneCop(px: number, py: number): void {
  panelBg(px, py, [178, 222, 240], [240, 248, 252]);
  // sun top right
  disc(px + 420, py + 40, 24, [255, 205, 60]);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    line(px + 420 + Math.cos(ang) * 30, py + 40 + Math.sin(ang) * 30,
      px + 420 + Math.cos(ang) * 42, py + 40 + Math.sin(ang) * 42, [255, 205, 60], 3);
  }
  // globe centre left
  const gx = px + 150;
  const gy = py + 100;
  disc(gx, gy, 58, [40, 120, 200]);
  disc(gx - 14, gy - 18, 16, [60, 170, 90]);
  disc(gx + 16, gy + 8, 20, [60, 170, 90]);
  disc(gx + 22, gy - 26, 10, [60, 170, 90]);
  disc(gx - 26, gy + 22, 9, [60, 170, 90]);
  // cloud wisps
  disc(gx - 30, gy - 34, 10, [255, 255, 255]);
  disc(gx + 6, gy + 30, 9, [255, 255, 255]);
  // oil barrel with a red cross
  const ox = px + 330;
  const oy = py + 84;
  fillRect(ox, oy, 76, 92, [40, 44, 52]);
  fillRect(ox, oy + 8, 76, 6, [70, 76, 86]);
  fillRect(ox, oy + 78, 76, 6, [70, 76, 86]);
  line(ox - 6, oy - 6, ox + 82, oy + 98, [220, 40, 40], 6);
  line(ox + 82, oy - 6, ox - 6, oy + 98, [220, 40, 40], 6);
  // label drawn last so it reads over the cross
  drawText(ox + 16, oy + 34, "OIL", 4, [255, 255, 255]);
  // ground line
  fillRect(px, py + SCENE_H - 8, PW, 8, [90, 160, 110]);
  // small thermometer
  fillRect(px + 250, py + 120, 10, 48, [220, 60, 60]);
  disc(px + 255, py + 172, 12, [220, 60, 60]);
  disc(px + 255, py + 172, 7, [255, 120, 120]);
}

// ---------- scene 5: Georgia mourns ----------
function sceneMourn(px: number, py: number): void {
  panelBg(px, py, [38, 42, 54], [22, 25, 34]);
  // damaged apartment block silhouette
  fillRect(px + 60, py + 60, 150, SCENE_H - 60, [70, 74, 88]);
  // jagged collapsed top
  tri(px + 60, py + 60, px + 110, py + 60, px + 85, py + 92, [70, 74, 88]);
  tri(px + 110, py + 60, px + 160, py + 60, px + 135, py + 88, [70, 74, 88]);
  tri(px + 160, py + 60, px + 210, py + 60, px + 185, py + 94, [70, 74, 88]);
  // dark windows, a few lit
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const lit = (r + c) % 3 === 0;
      fillRect(px + 74 + c * 28, py + 104 + r * 20, 14, 12, lit ? [255, 214, 110] : [28, 32, 44]);
    }
  }
  // second block, intact, to the right
  fillRect(px + 300, py + 84, 130, SCENE_H - 84, [58, 62, 76]);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      fillRect(px + 312 + c * 30, py + 100 + r * 24, 14, 12, (r * 2 + c) % 4 === 0 ? [255, 214, 110] : [28, 32, 44]);
    }
  }
  // candle in the foreground centre
  const cx = px + 248;
  fillRect(cx - 12, py + 118, 24, 62, [240, 238, 228]);
  fillRect(cx - 12, py + 118, 24, 6, [210, 208, 198]);
  // flame
  disc(cx, py + 100, 9, [255, 170, 40]);
  tri(cx - 7, py + 100, cx + 7, py + 100, cx, py + 78, [255, 210, 90]);
  disc(cx, py + 102, 4, [255, 240, 160]);
  // glow around the flame
  disc(cx, py + 96, 16, [255, 190, 80]);
  disc(cx, py + 96, 16, [255, 190, 80]);
  // redraw flame over the glow
  disc(cx, py + 100, 9, [255, 170, 40]);
  tri(cx - 7, py + 100, cx + 7, py + 100, cx, py + 78, [255, 210, 90]);
  disc(cx, py + 102, 4, [255, 240, 160]);
  // black mourning ribbon bow, top-left corner
  tri(px + 14, py + 12, px + 40, py + 30, px + 14, py + 48, [0, 0, 0]);
  tri(px + 66, py + 12, px + 40, py + 30, px + 66, py + 48, [0, 0, 0]);
  disc(px + 40, py + 30, 6, [0, 0, 0]);
  line(px + 38, py + 34, px + 30, py + 56, [0, 0, 0], 5);
  line(px + 42, py + 34, px + 50, py + 56, [0, 0, 0], 5);
  // ground
  fillRect(px, py + SCENE_H - 4, PW, 4, [12, 14, 20]);
}

// ---------- scene 6: Trump — permanent Iran deal ----------
function sceneDeal(px: number, py: number): void {
  panelBg(px, py, [232, 238, 244], [248, 250, 252]);
  // flag poles
  line(px + 96, py + 24, px + 96, py + 118, [90, 90, 90], 3);
  line(px + 400, py + 24, px + 400, py + 118, [90, 90, 90], 3);
  // US flag (left)
  const ux = px + 96;
  const uy = py + 26;
  for (let s = 0; s < 7; s++) {
    fillRect(ux, uy + s * 8, 120, 8, s % 2 === 0 ? [190, 40, 50] : WHITE);
  }
  fillRect(ux, uy, 48, 32, [30, 50, 110]);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      disc(ux + 7 + c * 11, uy + 6 + r * 10, 2, WHITE);
    }
  }
  // Iran flag (right)
  const ix = px + 280;
  const iy = py + 26;
  fillRect(ix, iy, 120, 19, [20, 140, 70]);
  fillRect(ix, iy + 19, 120, 18, WHITE);
  fillRect(ix, iy + 37, 120, 19, [200, 40, 40]);
  disc(ix + 60, iy + 28, 8, [200, 40, 40]);
  disc(ix + 60, iy + 28, 5, WHITE);
  // document on a table, centre
  fillRect(px + 148, py + 118, 200, 62, WHITE);
  line(px + 148, py + 118, px + 348, py + 118, INK, 2);
  line(px + 148, py + 180, px + 348, py + 180, INK, 2);
  line(px + 148, py + 118, px + 148, py + 180, INK, 2);
  line(px + 348, py + 118, px + 348, py + 180, INK, 2);
  for (let r = 0; r < 3; r++) {
    fillRect(px + 162, py + 130 + r * 12, 130, 4, [120, 130, 140]);
  }
  // gold seal
  disc(px + 322, py + 162, 12, GOLD);
  disc(px + 322, py + 162, 8, [220, 170, 40]);
  // pen
  line(px + 360, py + 128, px + 392, py + 168, [30, 60, 130], 4);
}

// ---------- compose ----------
function compose(): void {
  // page background
  fillRect(0, 0, W, H, PAPER);
  // header
  fillRect(0, 0, W, 100, NAVY);
  fillRect(0, 100, W, 4, GOLD);
  drawCentered(W / 2, 16, "THE WORLD ON SUNDAY", 4, WHITE);
  drawCentered(W / 2, 58, "22 NOVEMBER 2026", 3, GOLD);

  sceneAttack(PX[0], PY[0]);
  panelLabels(PX[0], PY[0], "RUSSIA'S OVERNIGHT ATTACK", "550 MUNITIONS HIT UKRAINE");
  sceneVote(PX[1], PY[0]);
  panelLabels(PX[1], PY[0], "HONG KONG VOTES", "723 SEATS, 856 CANDIDATES");
  sceneCricket(PX[0], PY[1]);
  panelLabels(PX[0], PY[1], "INDIA'S RECORD IN WELLINGTON", "PANT CENTURY, 629-6");
  sceneCop(PX[1], PY[1]);
  panelLabels(PX[1], PY[1], "COP31 TALKS DEADLOCKED", "FOSSIL FUELS CUT FROM DRAFT");
  sceneMourn(PX[0], PY[2]);
  panelLabels(PX[0], PY[2], "GEORGIA MOURNS", "DAY OF MOURNING FOR SIX");
  sceneDeal(PX[1], PY[2]);
  panelLabels(PX[1], PY[2], "TRUMP: PERMANENT IRAN DEAL", "DEAL MUST LAST 20 YEARS");

  // footer strip
  fillRect(0, 962, W, 62, NAVY);
  drawCentered(W / 2, 984, "ALSO: FBI PROBES CRIME DATABASE HACK - SPARTA II BURNS - VERSTAPPEN ON POLE", 2, WHITE);
}

function main(): void {
  compose();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  const png = encodePng();
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
}

main();
