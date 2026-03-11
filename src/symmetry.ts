import symdata from '../data/symmetry.json';
import type { SymOp } from './types.js';

/**
 * Parse a symmetry operation string (e.g. `+x,y-1/2,z`) into a rotation
 * matrix + translation vector pair.
 */
export function parseSymOp(symopstr: string): SymOp {
  const xyz = symopstr.split(',');
  if (xyz.length !== 3) throw new Error('Invalid symop string');

  const symre = /([+-]{0,1})(?:([xyz])|(?:([0-9]+)\/([0-9]+)))/g;
  const rotm: number[][] = [];
  const trns: number[] = [];

  for (let i = 0; i < 3; i++) {
    symre.lastIndex = 0;
    const r = [0, 0, 0];
    let t = 0.0;

    let res: RegExpExecArray | null;
    do {
      res = symre.exec(xyz[i]);
      if (!res) break;
      const sign = res[1] === '-' ? -1 : 1;
      if (res[2] === undefined) {
        // Translation component
        t += (sign * parseFloat(res[3])) / parseFloat(res[4]);
      } else {
        // Rotation component
        const j = 'xyz'.indexOf(res[2]);
        r[j] += sign;
      }
    } while (res);

    rotm.push(r);
    trns.push(t);
  }

  return [rotm, trns];
}

interface SpaceGroupEntry {
  hall_symbol: string;
  rotations: number[][][];
  translations: number[][];
}

/**
 * Look up a Hall symbol and return the full list of symmetry operations for
 * the corresponding space group.
 */
export function interpretHallSymbol(hsym: string): SymOp[] {
  const trimmed = hsym.trim();

  for (let i = 1; i <= 530; i++) {
    const entry = (symdata as Record<number, SpaceGroupEntry>)[i];
    if (entry?.hall_symbol === trimmed) {
      return entry.rotations.map((r, idx): SymOp => [r, entry.translations[idx]]);
    }
  }

  throw new Error(`Invalid Hall symbol: "${trimmed}"`);
}
