import { tokenRegex } from './tokens.js';
import type { Token, TokenType } from './types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CifValueType = 'int' | 'float' | 'string' | 'mstring' | 'N/A' | '?';

/**
 * Represents a single value (string or numerical) found in a CIF file.
 */
export class CifValue {
  type: CifValueType;
  /** Precision number (numerals only) */
  prec?: number;
  /** Numeric value (int or float) */
  num?: number;
  /** String value */
  text?: string;

  constructor(type: CifValueType, value?: number | string, prec?: number) {
    this.type = type;
    this.prec = prec;
    switch (type) {
      case 'int':
      case 'float':
        this.num = value as number;
        break;
      case 'string':
      case 'mstring':
        this.text = value as string;
        break;
      default:
        break;
    }
  }

  /** Return the underlying numeric or string value. */
  get_value(): number | string | undefined {
    return this.num !== undefined ? this.num : this.text;
  }
}

export interface SingleDataItem {
  tag: string;
  type: 'single';
  value: CifValue;
}

export interface LoopDataItem {
  tag: string;
  type: 'loop';
  value: CifValue[];
}

export type DataItem = SingleDataItem | LoopDataItem;
export type CifBlock = Record<string, DataItem>;
export type CifDict = Record<string, CifBlock>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function errormsg(msg: string, line: number): Error {
  return new Error(`ERROR @ line ${line}: ${msg}`);
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

/**
 * Split a CIF text string into elementary tokens for further processing.
 */
export function tokenize(cif: string): Token[] {
  const eol_re = tokenRegex('end_of_line', false, false);

  const all_re = [
    tokenRegex('whitespace', false, false),
    tokenRegex('quotestring', true),
    tokenRegex('semicolontext', true),
    tokenRegex('tag', true),
    tokenRegex('data_header', true),
    tokenRegex('loop_kw', true),
  ];

  const typeNames: TokenType[] = ['quotestring', 'semicolontext', 'tag', 'data_headers', 'loop_kw'];

  const tokenized: Token[] = [];
  let line_index = 1;
  let cifsl = cif.slice();

  while (cifsl.length > 0) {
    let slice_i = 0;
    let m_type = 1;
    let m: RegExpMatchArray | null = null;

    for (; m_type < all_re.length; m_type++) {
      m = cifsl.match(all_re[m_type]);
      if (m) break;
    }

    if (m) {
      tokenized.push({
        val: m[0],
        type: typeNames[m_type - 1],
        line: line_index,
      });
      slice_i = m[0].length;
    } else {
      all_re[0].lastIndex = 0;
      const w = all_re[0].exec(cifsl);
      if (w) {
        if (w.index === 0) {
          slice_i = w[0].length;
        } else {
          tokenized.push({
            val: cifsl.slice(0, w.index),
            type: 'unknown',
            line: line_index,
          });
          slice_i = w.index + w[0].length;
        }
      } else {
        if (cifsl.length > 0) {
          tokenized.push({ val: cifsl, type: 'unknown', line: line_index });
          slice_i = cifsl.length;
        }
      }
    }

    const parsed = cifsl.slice(0, slice_i);
    cifsl = cifsl.slice(slice_i);

    const newlines = parsed.match(eol_re);
    if (newlines) line_index += newlines.length;
  }

  return tokenized;
}

// ── Value parser ──────────────────────────────────────────────────────────────

/**
 * Parse a single token as a CIF value.
 */
export function parseValue(tok: Token): CifValue | null {
  if (tok.type === 'quotestring') {
    return new CifValue('string', tok.val.slice(1, tok.val.length - 1));
  }
  if (tok.type === 'semicolontext') {
    return new CifValue('mstring', tok.val.slice(1, tok.val.length - 1));
  }
  if (tok.type !== 'unknown') return null;

  const strval = tok.val;

  if (strval.trim() === '.') return new CifValue('N/A');
  if (strval.trim() === '?') return new CifValue('?');

  const m = tokenRegex('numeric', true, true).exec(strval.trim());
  if (m) {
    let prec: number | undefined;
    let strnum: string;
    if (m[3] === undefined) {
      prec = parseInt(m[2], 10);
      strnum = m[1];
    } else {
      strnum = m[3];
    }
    let type: CifValueType;
    let num: number;
    if (tokenRegex('float', true, true).test(strnum)) {
      num = parseFloat(strnum);
      type = 'float';
    } else {
      num = parseInt(strnum, 10);
      type = 'int';
    }
    return new CifValue(type, num, prec);
  }

  return new CifValue('string', strval);
}

// ── Block splitter ────────────────────────────────────────────────────────────

/**
 * Split a token array at `data_` headers, returning `[name, tokens]` pairs.
 */
export function parseDataBlocks(ciftokens: Token[]): [string, Token[]][] {
  const tagre = tokenRegex('tag');
  const data_headers: [number, string][] = [];

  for (let i = 0; i < ciftokens.length; i++) {
    const tok = ciftokens[i];
    if (tok.type === 'data_headers') {
      const name = tok.val.match(tagre);
      if (!name || name.length !== 1) throw errormsg('Invalid data header ' + tok.val, tok.line);
      data_headers.push([i, name[0].slice(1)]);
    }
  }

  return data_headers.map(([idx, name], i) => {
    const end = i < data_headers.length - 1 ? data_headers[i + 1][0] : ciftokens.length;
    return [name, ciftokens.slice(idx + 1, end)];
  });
}

// ── Data item parser ──────────────────────────────────────────────────────────

const VTYPES: TokenType[] = ['quotestring', 'semicolontext', 'unknown'];

/**
 * Parse a sequence of tokens representing the body of a data block into
 * structured data items.
 */
export function parseDataItems(blocktokens: Token[]): DataItem[] {
  const data_items: DataItem[] = [];
  const btokens = blocktokens.slice();

  while (btokens.length > 0) {
    const btok = btokens.shift();
    if (btok === undefined) break;

    switch (btok.type) {
      case 'tag': {
        const valtok = btokens.shift();
        if (!valtok || !VTYPES.includes(valtok.type)) {
          throw errormsg('Invalid or missing value for tag ' + btok.val, btok.line);
        }
        data_items.push({
          tag: btok.val,
          type: 'single',
          value: parseValue(valtok) as CifValue,
        });
        break;
      }

      case 'loop_kw': {
        const header: string[] = [];
        let ltok = btokens.shift();
        let loop_end = btok.line;

        while (ltok !== undefined && ltok.type === 'tag') {
          header.push(ltok.val);
          loop_end = ltok.line;
          ltok = btokens.shift();
        }

        const body: CifValue[] = [];
        while (ltok !== undefined && VTYPES.includes(ltok.type)) {
          body.push(parseValue(ltok) as CifValue);
          loop_end = ltok.line;
          ltok = btokens.shift();
        }
        // Put back the token that ended the loop
        if (ltok !== undefined) btokens.unshift(ltok);

        if (body.length % header.length !== 0) {
          throw errormsg('Invalid loop - values must be a multiple of tags', loop_end);
        }

        const tagn = header.length;
        const loopn = body.length / tagn;
        for (let i = 0; i < header.length; i++) {
          const values: CifValue[] = [];
          for (let j = 0; j < loopn; j++) values.push(body[j * tagn + i]);
          data_items.push({ tag: header[i], type: 'loop', value: values });
        }
        break;
      }

      default:
        break;
    }
  }

  return data_items;
}

// ── Top-level parser ──────────────────────────────────────────────────────────

/**
 * Parse a CIF file string into a dictionary of named data blocks and their
 * items.  This is the low-level API; for full crystal structures use
 * `Atoms.readCif` or `parseCifStructures`.
 */
export function parseCif(ciftext: string): CifDict {
  const tk = tokenize(ciftext);
  const db = parseDataBlocks(tk);

  const cifdict: CifDict = {};
  for (const [name, blockTokens] of db) {
    cifdict[name] = {};
    const items = parseDataItems(blockTokens);
    for (const item of items) {
      cifdict[name][item.tag] = item;
    }
  }
  return cifdict;
}
