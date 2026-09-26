/**
 * Parser do protocolo texto do decoder TranX (porta TCP 5100).
 *
 * Portado do LapTime.Server (LapTimeCore.cs, case TypeProtocol TRX), decompilado na
 * engenharia reversa. Cada registro vem numa linha terminada em CRLF, prefixada por SOH
 * (0x01), com campos separados por TAB:
 *
 *   status:   SOH # <decoder> <?> <ruido> <?> x<crc>
 *   passagem: SOH $ <decoder> <seq> <transponder hex> <tempo ms hex> <hits hex> <forca hex> [<bateria hex>] x<crc>
 *
 * Existe tambem um formato antigo sem TAB, de largura fixa (25/26 chars), tratado igual.
 */

export type TrxPassing = {
  kind: 'passing';
  decoderId: string;
  sequence: number | null;
  /** ID bruto do transponder (decimal). Ainda precisa do renumber pra virar numero de kart. */
  transponder: number;
  /** Tempo do relogio interno do decoder, em ms. So diferencas entre passagens importam. */
  decoderTimeMs: number;
  hits: number | null;
  strength: number | null;
  raw: string;
};

export type TrxStatus = {
  kind: 'status';
  decoderId: string;
  noise: number | null;
  raw: string;
};

export type TrxRecord = TrxPassing | TrxStatus | { kind: 'other'; raw: string };

/** Transponders especiais do protocolo que nao sao karts (marcadores de reset/manual). */
const SPECIAL_TRANSPONDERS = new Set([0, 9991, 9993]);

function hex(value: string | undefined): number | null {
  if (value === undefined || value === '' || !/^[0-9a-fA-F]+$/.test(value)) return null;
  return parseInt(value, 16);
}

export function parseTrxLine(line: string): TrxRecord {
  const raw = line.replace(/[\r\n]+$/, '');
  const clean = raw.split('\u0001').join('').trim(); // SOH que abre cada registro
  if (!clean) return { kind: 'other', raw };

  let fields = clean.split('\t');

  // Formato antigo de largura fixa: "$DDSSTTTTTTMMMMMMMMHHFFBB"
  if (fields.length === 1 && (clean.length === 25 || clean.length === 26)) {
    fields = [
      clean.slice(0, 1),
      clean.slice(1, 3),
      clean.slice(3, 5),
      clean.slice(5, 11),
      clean.slice(11, 19),
      clean.slice(19, 21),
      clean.slice(21, 23),
      clean.slice(23, 25),
    ];
  }

  const type = fields[0];
  const decoderId = fields[1] ?? '';

  if (type === '#') {
    return { kind: 'status', decoderId, noise: hex(fields[3]), raw };
  }

  if (type === '$' && fields.length > 6) {
    const transponder = hex(fields[3]);
    let timeField = fields[4] ?? '';
    // Mesma correcao que o LapTime aplica pra um overflow conhecido do relogio do TranX.
    if (timeField.startsWith('4BC6A') || timeField.startsWith('19999')) {
      timeField = '000000' + timeField.slice(6, 8);
    }
    const decoderTimeMs = hex(timeField);
    if (transponder === null || decoderTimeMs === null || SPECIAL_TRANSPONDERS.has(transponder)) {
      return { kind: 'other', raw };
    }
    const seq = Number.parseInt(fields[2] ?? '', 10);
    return {
      kind: 'passing',
      decoderId,
      sequence: Number.isFinite(seq) ? seq : null,
      transponder,
      decoderTimeMs,
      hits: hex(fields[5]),
      strength: hex(fields[6]),
      raw,
    };
  }

  // Formato decimal (o que o TranX do kartódromo manda depois do @RESET), igual ao LapTime:
  //   SOH @ <decoder> <seq> <transponder decimal> <segundos.milésimos> <hits> <força> <bateria> x<crc>
  if (type !== '$' && type !== '#' && fields.length >= 8 && /^\d+$/.test(fields[3] ?? '') && /^\d+(\.\d+)?$/.test(fields[4] ?? '')) {
    const transponder = Number.parseInt(fields[3], 10);
    if (SPECIAL_TRANSPONDERS.has(transponder)) return { kind: 'other', raw };
    let [seg, frac = ''] = fields[4].split('.');
    if (seg === '18446744073709') seg = '0'; // overflow do relógio que o LapTime também zera
    const decoderTimeMs = Number.parseInt(seg, 10) * 1000 + Number.parseInt(frac.padEnd(3, '0').slice(0, 3), 10);
    const seq = Number.parseInt(fields[2] ?? '', 10);
    const dec = (v: string | undefined) => (v !== undefined && /^\d+$/.test(v) ? Number.parseInt(v, 10) : null);
    return {
      kind: 'passing',
      decoderId,
      sequence: Number.isFinite(seq) ? seq : null,
      transponder,
      decoderTimeMs,
      hits: dec(fields[5]),
      strength: dec(fields[6]),
      raw,
    };
  }

  return { kind: 'other', raw };
}

/** Acumula bytes do socket e devolve linhas completas (separador CR/LF). */
export class LineSplitter {
  private buffer = '';

  push(chunk: string): string[] {
    this.buffer += chunk;
    const parts = this.buffer.split(/\r?\n/);
    this.buffer = parts.pop() ?? '';
    // protege contra lixo sem quebra de linha crescendo pra sempre
    if (this.buffer.length > 4096) this.buffer = '';
    return parts.filter((p) => p.length > 0);
  }
}

/** Monta uma linha de passagem no formato do TranX (usado pelo simulador e testes). */
export function formatTrxPassing(p: {
  decoderId?: string;
  sequence: number;
  transponder: number;
  decoderTimeMs: number;
  hits?: number;
  strength?: number;
}): string {
  const h = (n: number, w = 1) => n.toString(16).toUpperCase().padStart(w, '0');
  return (
    '\u0001' +
    ['$', p.decoderId ?? '20', String(p.sequence), h(p.transponder, 6), h(p.decoderTimeMs, 8), h(p.hits ?? 40, 2), h(p.strength ?? 120, 2), '0', 'x0000'].join('\t') +
    '\r\n'
  );
}
