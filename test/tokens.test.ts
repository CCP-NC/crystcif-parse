import { describe, it, expect } from 'vitest';
import { tokenRegex } from '../src/tokens.js';

describe('#tokens', () => {
  it('should match comment strings', () => {
    const re = tokenRegex('comments');
    const res = re.exec('a_valid_token # A comment\n');
    expect(res![0]).toBe('# A comment\n');
  });

  it('should recognise whitespace', () => {
    const re = tokenRegex('whitespace');
    const res = re.exec('a_token # A comment \n another_token');
    expect(res!.index).toBe(7);
    expect(res![0]).toBe(' # A comment \n ');
  });

  it('should match semicolon text blocks', () => {
    const re = tokenRegex('semicolontext');
    const res = re.exec('a_token\n;A text block\n\n;\nanother_token');
    expect(res!.index).toBe(8);
    expect(res![0]).toBe(';A text block\n\n;');
  });

  it('should match (un)quoted strings', () => {
    let re = tokenRegex('squotestring');
    let res = re.exec("'this and' that");
    expect(res!.index).toBe(0);
    expect(res![0]).toBe("'this and'");

    re = tokenRegex('dquotestring');
    res = re.exec('this "and that"');
    expect(res!.index).toBe(5);
    expect(res![0]).toBe('"and that"');

    re = tokenRegex('uquotestring');
    res = re.exec('\nthis and that');
    expect(res!.index).toBe(0);
    expect(res![0]).toBe('\nthis');

    re = tokenRegex('chrstring');
    res = re.exec("'this and' that");
    expect(res!.index).toBe(0);
    expect(res![0]).toBe("'this and'");

    re.lastIndex = 0;
    res = re.exec(' this "and that"');
    expect(res!.index).toBe(0);
    expect(res![0]).toBe(' this');

    res = re.exec('this "and that"');
    expect(res!.index).toBe(5);
    expect(res![0]).toBe('"and that"');
  });

  it('should match number types', () => {
    let re = tokenRegex('integer');
    let res = re.exec('He stole +40 cakes;');
    expect(res!.index).toBe(9);
    expect(res![0]).toBe('+40');

    re = tokenRegex('unsigned_int');
    res = re.exec('He stole +40 cakes;');
    expect(res!.index).toBe(10);
    expect(res![0]).toBe('40');

    re = tokenRegex('exponent');
    res = re.exec('He stole 1E+40 cakes;');
    expect(res!.index).toBe(10);
    expect(res![0]).toBe('E+40');

    re = tokenRegex('float');
    res = re.exec('He stole 40.0e0 cakes');
    expect(res!.index).toBe(9);
    expect(res![0]).toBe('40.0e0');

    re = tokenRegex('number');
    res = re.exec('He stole +40 cakes;');
    expect(res!.index).toBe(9);
    expect(res![0]).toBe('+40');
    re.lastIndex = 0;
    res = re.exec('He stole 40.0e0 cakes');
    expect(res!.index).toBe(9);
    expect(res![0]).toBe('40.0e0');

    re = tokenRegex('numeric');
    res = re.exec('He stole +40.0E3(25) cakes;');
    expect(res!.index).toBe(9);
    expect(res![0]).toBe('+40.0E3(25)');
  });

  it('should match reserved words', () => {
    const re = tokenRegex('reserved');
    let res = re.exec('this is data');
    expect(res!.index).toBe(8);
    expect(res![0]).toBe('data');
    re.lastIndex = 0;
    res = re.exec('and a LooP');
    expect(res!.index).toBe(6);
    expect(res![0].toLowerCase()).toBe('loop');
  });

  it('should match tag tokens', () => {
    const re = tokenRegex('tag');
    // data_my_info contains _my_info which is a valid tag
    const res = re.exec('data_my_info 34.3E2');
    expect(res).not.toBeNull();
    expect(res![0]).toBe('_my_info');
    expect(res!.index).toBe(4);
  });
});
