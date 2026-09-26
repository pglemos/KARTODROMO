/**
 * Protocolo binário P3 (MYLAPS/AMB), porta TCP 5403 do decoder — o mesmo que o Orbits 4 usa.
 *
 * Quadro: 0x8E <versão u8> <tamanho u16> <crc u16> <flags u16> <tipo u16> <campos TLV...> 0x8F
 * Bytes 0x8A..0x8F dentro do quadro vêm escapados como 0x8D, (byte + 0x20).
 * Tipo 0x0001 = passagem: 0x01 nº passagem u32 · 0x03 transponder u32 · 0x04 horário RTC u64 (µs)
 *                         0x05 força u16 · 0x06 hits u16
 * Tipo 0x0002 = status:   0x01 ruído u16
 *
 * O horário RTC é absoluto (não zera quando alguém reconecta), então as voltas saem idênticas às do Orbits.
 */
import type { TrxPassing, TrxStatus } from './trx-parser';

export type P3Record = TrxPassing | TrxStatus | { kind: 'other'; raw: string };

const SOR = 0x8e;
const EOR = 0x8f;
const ESC = 0x8d;

/** Quadros especiais de transponder que não são karts (mesmos do TRX). */
const SPECIAL = new Set([0, 9991, 9993]);

export function parseP3Frame(frame: Buffer): P3Record {
  const raw = frame.toString('hex');
  if (frame.length < 9) return { kind: 'other', raw };
  const tor = frame.readUInt16LE(7);
  const fields = new Map<number, Buffer>();
  for (let i = 9; i + 2 <= frame.length;) {
    const tof = frame[i];
    const len = frame[i + 1];
    if (i + 2 + len > frame.length) break;
    fields.set(tof, frame.subarray(i + 2, i + 2 + len));
    i += 2 + len;
  }
  const u16 = (k: number) => (fields.get(k)?.length ?? 0) >= 2 ? fields.get(k)!.readUInt16LE(0) : null;
  const u32 = (k: number) => (fields.get(k)?.length ?? 0) >= 4 ? fields.get(k)!.readUInt32LE(0) : null;
  const u64 = (k: number) => (fields.get(k)?.length ?? 0) >= 8 ? fields.get(k)!.readBigUInt64LE(0) : null;
  const decoderId = (u32(0x81) ?? 0).toString(16);

  if (tor === 0x0001) {
    const transponder = u32(0x03);
    const rtc = u64(0x04);
    if (transponder === null || rtc === null || SPECIAL.has(transponder)) return { kind: 'other', raw };
    // µs -> ms inteiro (o TranX tem resolução de 1 ms; o Orbits também grava em ms)
    const decoderTimeMs = Number(rtc / 1000n);
    return { kind: 'passing', decoderId, sequence: u32(0x01), transponder, decoderTimeMs, hits: u16(0x06), strength: u16(0x05), raw };
  }
  if (tor === 0x0002) return { kind: 'status', decoderId, noise: u16(0x01), raw };
  return { kind: 'other', raw };
}

/** Acumula bytes do socket e devolve quadros completos, já sem escape e sem 0x8E/0x8F. */
export class P3FrameSplitter {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): Buffer[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const out: Buffer[] = [];
    for (;;) {
      const start = this.buffer.indexOf(SOR);
      if (start < 0) { this.buffer = Buffer.alloc(0); break; }
      const end = this.buffer.indexOf(EOR, start + 1);
      if (end < 0) { this.buffer = this.buffer.subarray(start); break; }
      const body = this.buffer.subarray(start + 1, end);
      this.buffer = this.buffer.subarray(end + 1);
      const bytes: number[] = [];
      for (let i = 0; i < body.length; i++) {
        if (body[i] === ESC && i + 1 < body.length) bytes.push(body[++i] - 0x20);
        else bytes.push(body[i]);
      }
      out.push(Buffer.from(bytes));
    }
    if (this.buffer.length > 65536) this.buffer = Buffer.alloc(0);
    return out;
  }
}
