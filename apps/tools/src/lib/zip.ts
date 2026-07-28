import { deflateRawSync } from "node:zlib";

const encoder = new TextEncoder();
const u16 = (value: number) => Uint8Array.from([value & 255, (value >>> 8) & 255]);
const u32 = (value: number) => Uint8Array.from([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
const join = (parts: Uint8Array[]) => { const length = parts.reduce((sum, part) => sum + part.length, 0); const output = new Uint8Array(length); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; };
const crc32 = (data: Uint8Array) => { let value = 0xffffffff; for (const byte of data) { value ^= byte; for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); } return (value ^ 0xffffffff) >>> 0; };

export function zip(files: Array<{ name: string; content: string }>) {
  const local: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name); const input = encoder.encode(file.content); const compressed = deflateRawSync(input); const body = new Uint8Array(compressed); const crc = crc32(input);
    const header = join([u32(0x04034b50), u16(20), u16(0), u16(8), u16(0), u16(0), u32(crc), u32(body.length), u32(input.length), u16(name.length), u16(0), name]);
    local.push(header, body);
    central.push(join([u32(0x02014b50), u16(20), u16(20), u16(0), u16(8), u16(0), u16(0), u32(crc), u32(body.length), u32(input.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += header.length + body.length;
  }
  const centralBytes = join(central); return join([...local, centralBytes, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralBytes.length), u32(offset), u16(0)]);
}
