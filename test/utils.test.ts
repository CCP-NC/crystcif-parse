import { describe, it, expect } from 'vitest';
import * as utils from '../src/utils.js';

describe('#utils', () => {
  it('should correctly compute a unit vector', () => {
    const v: [number, number, number] = [0, 3, 4];
    const u = utils.unit(v);
    expect(u).toEqual([0, 3 / 5, 4 / 5]);
  });

  it('should correctly verify multiple elements', () => {
    expect(utils.includesAll([1, 2, 3, 4], [1, 2])).toBe(true);
    expect(utils.includesAll([1, 2, 3, 4], [1, 5])).toBe(false);
  });

  it('should correctly reduce vectors to modulo 1', () => {
    const v = [1.2, 0.5, -3.4];
    const u = utils.mod1(v);
    const expected = [0.2, 0.5, 0.6];
    for (let i = 0; i < 3; i++) expect(u[i]).toBeCloseTo(expected[i], 5);
  });

  it('should correctly find the shortest periodic length of a [0,1)^3 vector', () => {
    const v = [0.3, 0.6, 0.0];
    expect(utils.shortestPeriodicLength(v)).toBeCloseTo(0.5, 5);
  });
});
