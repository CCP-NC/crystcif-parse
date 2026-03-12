import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tokenize, parseValue, parseDataBlocks, parseDataItems, parseCif } from '../src/parse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('#parsing', () => {
  it('should correctly split in tokens', () => {
    const test = " _tag 12 C 'test string' loop_\ndata_block";
    const tk = tokenize(test);
    expect(tk[0].val).toBe('_tag');
    expect(tk[1].type).toBe('unknown');
    expect(tk[3].val).toBe("'test string'");
    expect(tk[5].val).toBe('data_block');
  });

  it('should correctly deal with Windows-style line endings', () => {
    const test = '_tag 0\r\n_tag 1';
    const tk = tokenize(test);
    expect(tk[0].val).toBe('_tag');
    expect(tk[1].val).toBe('0');
    expect(tk[2].val).toBe('_tag');
    expect(tk[3].val).toBe('1');
    expect(tk[0].line).toBe(1);
    expect(tk[2].line).toBe(2);
  });

  it('should identify the right data blocks', () => {
    const test = 'data_1 _tag value data_2 _tag value _tag value';
    const tk = tokenize(test);
    const bl = parseDataBlocks(tk);
    expect(bl[0][0]).toBe('1');
    expect(bl[1][0]).toBe('2');
    expect(bl[0][1].length).toBe(2);
    expect(bl[0][1][0].type).toBe('tag');
    expect(bl[1][1].length).toBe(4);
    expect(bl[0][1][1].type).toBe('unknown');
  });

  it('should correctly parse values', () => {
    const numTok = { type: 'unknown' as const, val: '56.4e3(45)', line: 1 };
    const val = parseValue(numTok)!;
    expect(val.num).toBe(56400);
    expect(val.prec).toBe(45);

    const strTok = { type: 'unknown' as const, val: 'thing', line: 1 };
    const strVal = parseValue(strTok)!;
    expect(strVal.type).toBe('string');
  });

  it('should correctly parse a series of data items', () => {
    const test = '_one 1.0 _fortytwo 42 _string str loop_ _a _b 1 2 3 4';
    const tk = tokenize(test);
    const items = parseDataItems(tk);
    expect(items[0].value).toMatchObject({ type: 'float' });
    expect((items[1].value as import('../src/parse.js').CifValue).num).toBe(42);
    expect(items[2].tag).toBe('_string');
    expect(items[3].tag).toBe('_a');
    expect((items[3].value as import('../src/parse.js').CifValue[])[1].num).toBe(3);
    expect((items[4].value as import('../src/parse.js').CifValue[])[0].num).toBe(2);
  });

  it('should parse a whole file', () => {
    const contents = readFileSync(resolve(__dirname, '../examples/example_single.cif'), 'utf8');
    const cifdict = parseCif(contents);

    expect(cifdict).toHaveProperty('global');
    expect(cifdict).toHaveProperty('I');
    expect(cifdict.global['_publ_body_element'].type).toBe('loop');
    expect(
      (cifdict.I['_chemical_formula_moiety'].value as import('../src/parse.js').CifValue).text,
    ).toBe('C19 H19 N O3');
  });

  it('should throw appropriate errors', () => {
    // Tag with no value
    const badTag = '_tag 1\n_tag\n_tag';
    const tk1 = tokenize(badTag);
    expect(() => parseDataItems(tk1)).toThrow(
      'ERROR @ line 2: Invalid or missing value for tag _tag',
    );

    // Bad loop
    const badLoop = 'loop_\n_atom_site_label\n_atom_site_type_symbol\nC';
    const tk2 = tokenize(badLoop);
    expect(() => parseDataItems(tk2)).toThrow(
      'ERROR @ line 4: Invalid loop - values must be a multiple of tags',
    );
  });
});
