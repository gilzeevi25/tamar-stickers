"use client";

/**
 * Cat-printer family BLE protocol — TypeScript port.
 *
 * Compatible with GB01/GB02/GB03/GT01/YT01/MX05/MX06/MX08/MX10/MXTP. All these
 * printers share one BLE service and one packet framing scheme:
 *
 *   0x51 0x78  CMD  0x00  LEN_LO  LEN_HI   <data...>   CRC8   0xFF
 *
 * Hardware width is fixed at 384 dots (48 bytes per row, MSB-first).
 *
 * Reference: https://github.com/NaitLee/Cat-Printer (original Python + JS impl).
 */

export const PRINTER_SERVICE_UUID = "0000ae30-0000-1000-8000-00805f9b34fb";
export const PRINTER_WRITE_UUID = "0000ae01-0000-1000-8000-00805f9b34fb";
export const PRINTER_NOTIFY_UUID = "0000ae02-0000-1000-8000-00805f9b34fb";
export const NAME_PREFIXES = ["GB", "GT", "YT", "MX"];

export const PRINTER_WIDTH_PX = 384;
const ROW_BYTES = PRINTER_WIDTH_PX / 8; // 48
const BLE_CHUNK = 100; // safe MTU; matches reference impl

const CMD = {
  RETRACT_PAPER: 0xa0,
  FEED_PAPER: 0xa1,
  DRAW_BITMAP: 0xa2,
  GET_DEV_STATE: 0xa3,
  SET_QUALITY: 0xa4,
  LATTICE_CONTROL: 0xa6,
  GET_DEV_INFO: 0xa8,
  OTHER_FEED_PAPER: 0xbd,
  DRAWING_MODE: 0xbe,
  SET_ENERGY: 0xaf,
  UPDATE_DEVICE: 0xa9,
} as const;

const LATTICE_START = [
  0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c,
];
const LATTICE_END = [
  0xaa, 0x55, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17,
];

// ---- CRC8 (poly 0x07, init 0x00) ----

const CRC8_TABLE = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 0x80) !== 0 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
    }
    t[i] = c;
  }
  return t;
})();

function crc8(data: ArrayLike<number>): number {
  let c = 0;
  for (let i = 0; i < data.length; i++) {
    c = CRC8_TABLE[(c ^ data[i]) & 0xff];
  }
  return c & 0xff;
}

function makePacket(cmd: number, payload: ArrayLike<number>): Uint8Array {
  const len = payload.length;
  const buf = new Uint8Array(8 + len);
  buf[0] = 0x51;
  buf[1] = 0x78;
  buf[2] = cmd;
  buf[3] = 0x00;
  buf[4] = len & 0xff;
  buf[5] = (len >> 8) & 0xff;
  for (let i = 0; i < len; i++) buf[6 + i] = payload[i];
  buf[6 + len] = crc8(payload);
  buf[7 + len] = 0xff;
  return buf;
}

// ---- bit-twiddle: 1-bit PNG → row bytes ----

/** Decode a PNG (1-bit or any) into a width-clamped binary bitmap. */
async function decodeToBinaryRows(pngBytes: Uint8Array): Promise<Uint8Array[]> {
  const blob = new Blob([new Uint8Array(pngBytes)], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);

  // Pad/center to printer width if narrower; otherwise scale down to width.
  const targetW = PRINTER_WIDTH_PX;
  const scale = bitmap.width > targetW ? targetW / bitmap.width : 1;
  const drawW = Math.round(bitmap.width * scale);
  const drawH = Math.round(bitmap.height * scale);
  const offX = Math.max(0, Math.floor((targetW - drawW) / 2));

  const canvas = new OffscreenCanvas(targetW, drawH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("offscreen_canvas_unsupported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, drawH);
  ctx.drawImage(bitmap, offX, 0, drawW, drawH);
  const { data } = ctx.getImageData(0, 0, targetW, drawH);

  const rows: Uint8Array[] = [];
  for (let y = 0; y < drawH; y++) {
    const row = new Uint8Array(ROW_BYTES);
    for (let x = 0; x < targetW; x++) {
      const i = (y * targetW + x) * 4;
      // Luma: dark pixel = print = bit set.
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const dark = luma < 128 && data[i + 3] > 16;
      if (dark) {
        row[x >> 3] |= 0x80 >> (x & 7);
      }
    }
    rows.push(row);
  }
  return rows;
}

// ---- BLE plumbing ----

export interface PrinterHandle {
  device: BluetoothDevice;
  writeChar: BluetoothRemoteGATTCharacteristic;
  disconnect: () => void;
}

const LAST_DEVICE_KEY = "tamar-stickers:last-printer-name";

export function getLastDeviceName(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_DEVICE_KEY);
}

function rememberDevice(device: BluetoothDevice) {
  if (typeof localStorage === "undefined" || !device.name) return;
  localStorage.setItem(LAST_DEVICE_KEY, device.name);
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function connectPrinter(): Promise<PrinterHandle> {
  if (!isWebBluetoothSupported()) {
    throw new Error("web_bluetooth_unsupported");
  }
  const device = await navigator.bluetooth.requestDevice({
    filters: NAME_PREFIXES.map((p) => ({ namePrefix: p })),
    optionalServices: [PRINTER_SERVICE_UUID],
  });
  if (!device.gatt) throw new Error("no_gatt");

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
  const writeChar = await service.getCharacteristic(PRINTER_WRITE_UUID);

  rememberDevice(device);

  return {
    device,
    writeChar,
    disconnect: () => {
      try {
        device.gatt?.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}

async function writeChunked(
  ch: BluetoothRemoteGATTCharacteristic,
  bytes: Uint8Array,
) {
  // Copy into a fresh ArrayBuffer-backed view so the BLE stack always sees
  // a plain ArrayBuffer (not SharedArrayBuffer), and so we can safely subarray.
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const view = new Uint8Array(buf);

  // writeValueWithoutResponse is ~10x faster on BLE; fall back if unsupported.
  type Writer = (data: BufferSource) => Promise<void>;
  const fast = (
    ch as BluetoothRemoteGATTCharacteristic & {
      writeValueWithoutResponse?: Writer;
    }
  ).writeValueWithoutResponse;
  const write: Writer = fast ? fast.bind(ch) : ch.writeValue.bind(ch);

  for (let off = 0; off < view.length; off += BLE_CHUNK) {
    const slice = view.subarray(off, Math.min(off + BLE_CHUNK, view.length));
    await write(slice);
  }
}

// ---- printing ----

export interface PrintOptions {
  /** Energy = darkness. Higher = darker but slower. 0..0xFFFF. */
  energy?: number;
  /** 1..5, higher = denser passes. 5 is the safe default. */
  quality?: number;
  /** Lines of blank paper to feed at the end. */
  feedLines?: number;
  onProgress?: (rowsPrinted: number, totalRows: number) => void;
}

function u16le(v: number): [number, number] {
  return [v & 0xff, (v >> 8) & 0xff];
}

export async function printImage(
  handle: PrinterHandle,
  pngBytes: Uint8Array,
  opts: PrintOptions = {},
): Promise<void> {
  const energy = opts.energy ?? 0x3000;
  const quality = opts.quality ?? 5;
  const feedLines = opts.feedLines ?? 80;
  const onProgress = opts.onProgress;

  const rows = await decodeToBinaryRows(pngBytes);
  const ch = handle.writeChar;

  // ---- header: query, set quality, lattice begin, drawing mode, set energy
  const header: Uint8Array[] = [
    makePacket(CMD.GET_DEV_STATE, [0x00]),
    makePacket(CMD.SET_QUALITY, [quality]),
    makePacket(CMD.LATTICE_CONTROL, LATTICE_START),
    makePacket(CMD.DRAWING_MODE, [0x00]), // 0=image, 1=text
    makePacket(CMD.SET_ENERGY, u16le(energy)),
  ];
  for (const p of header) await writeChunked(ch, p);

  // ---- body: stream rows
  const total = rows.length;
  for (let i = 0; i < total; i++) {
    await writeChunked(ch, makePacket(CMD.DRAW_BITMAP, rows[i]));
    if (onProgress && (i % 8 === 0 || i === total - 1)) {
      onProgress(i + 1, total);
    }
  }

  // ---- footer: lattice end, feed
  await writeChunked(ch, makePacket(CMD.LATTICE_CONTROL, LATTICE_END));
  await writeChunked(ch, makePacket(CMD.FEED_PAPER, u16le(feedLines)));
}
