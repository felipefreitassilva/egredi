import zlib from "node:zlib";

export function readZip(buf: Buffer): Record<string, Buffer> {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  const minScan = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= minScan; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("arquivo .zip inválido (EOCD não encontrado)");

  const entryCount = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files: Record<string, Buffer> = {};

  for (let n = 0; n < entryCount; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50)
      throw new Error("central directory corrompido");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) continue;
    if (buf.readUInt32LE(localOffset) !== 0x04034b50)
      throw new Error(`local header inválido em "${name}"`);
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    if (method === 0) files[name] = raw;
    else if (method === 8) files[name] = zlib.inflateRawSync(raw);
    else throw new Error(`compressão ${method} não suportada em "${name}"`);
  }
  return files;
}
