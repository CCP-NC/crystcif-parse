import * as mjs from 'mathjs';
import mendeleev from 'mendeleev';

import {
  deepClone,
  cross,
  unit,
  mod1,
  degToRad,
  radToDeg,
  shortestPeriodicLength,
} from './utils.js';
import { parseCif } from './parse.js';
import { parseSymOp, interpretHallSymbol } from './symmetry.js';
import type { Vec3, Matrix3x3, CellPar, SymOp } from './types.js';
import type { CifBlock, DataItem } from './parse.js';

const mndtable = mendeleev.PeriodicTable;

// ── Cell conversion ───────────────────────────────────────────────────────────

/**
 * Convert a Cartesian cell (3×3 row vectors) to lengths-and-angles form.
 * @param radians  If true, return angles in radians (degrees by default)
 */
export function cellToCellpar(cell: number[][], radians = false): CellPar {
  const lengths = cell.map((c) => mjs.norm(c) as number) as Vec3;
  const angles: number[] = [];

  for (let i = 0; i < 3; i++) {
    const j = (i + 2) % 3;
    const k = (i + 1) % 3;
    const ll = lengths[j] * lengths[k];
    let angle: number;
    if (ll > 1e-16) {
      const x = (mjs.dot(cell[j], cell[k]) as number) / ll;
      angle = Math.acos(x);
    } else {
      angle = Math.PI / 2.0;
    }
    angles.push(angle);
  }

  const finalAngles = radians ? angles : angles.map(radToDeg);
  return [lengths, finalAngles as Vec3];
}

/**
 * Convert a cell from lengths-and-angles form to Cartesian (3×3 row vectors).
 * @param ab_normal   Desired direction for the normal to the AB plane
 * @param a_direction Direction for the a axis
 * @param radians     If true, treat angles as radians
 */
export function cellparToCell(
  cellpar: CellPar,
  ab_normal?: number[],
  a_direction?: number[],
  radians = false,
): Matrix3x3 {
  ab_normal = ab_normal ?? [0, 0, 1];

  if (!a_direction) {
    a_direction =
      (mjs.norm(cross(ab_normal as Vec3, [1, 0, 0])) as number) < 1e-5 ? [0, 0, 1] : [1, 0, 0];
  }

  const ad = unit(a_direction);
  const Z = unit(ab_normal);
  const X = unit(
    mjs.subtract(ad, mjs.dotMultiply(mjs.dot(ad, Z) as number, Z) as number[]) as number[],
  );
  const Y = cross(Z as Vec3, X as Vec3);

  const l = cellpar[0];
  let angs = [...cellpar[1]] as number[];
  if (!radians) angs = angs.map(degToRad);

  const cosa = angs.map(Math.cos);
  let sina = angs.map(Math.sin);

  for (let i = 0; i < 3; i++) {
    if (Math.abs(Math.abs(sina[i]) - 1) < 1e-14) {
      sina[i] = Math.sign(sina[i]);
      cosa[i] = 0.0;
    }
  }

  const va: Vec3 = [l[0], 0, 0];
  const vb: Vec3 = [l[1] * cosa[2], l[1] * sina[2], 0];
  const vc: Vec3 = [l[2] * cosa[1], (l[2] * (cosa[0] - cosa[1] * cosa[2])) / sina[2], 0];
  vc[2] = Math.sqrt(l[2] * l[2] - vc[0] * vc[0] - vc[1] * vc[1]);

  return mjs.multiply([va, vb, vc], [X, Y, Z]) as Matrix3x3;
}

// ── Cell input union type ─────────────────────────────────────────────────────

/**
 * Acceptable formats for the unit cell passed to `Atoms`:
 * - `null`/`false`/`undefined`: no periodic boundary
 * - `number`: cubic cell with that lattice parameter
 * - `[a, b, c]`: orthorhombic cell
 * - `[[a,b,c],[alpha,beta,gamma]]`: lengths-and-angles (CellPar)
 * - `[[...], [...], [...]]`: full Cartesian 3×3 cell
 * - `(number | null)[]` of length 3: partial periodicity (null = non-periodic axis)
 */
export type CellInput =
  | null
  | false
  | undefined
  | number
  | CellPar
  | Matrix3x3
  | (number | null | false)[];

// ── Atoms class ───────────────────────────────────────────────────────────────

/**
 * A crystallographic structure inspired by ASE's Atoms class.
 */
export class Atoms {
  private _arrays: Record<string, unknown[]>;
  private _N: number;
  private _pbc: [boolean, boolean, boolean];
  private _cell: (Vec3 | null)[] | null;
  private _inv_cell: number[][] | null;
  /** Arbitrary metadata attached to this structure */
  info: Record<string, unknown>;

  /**
   * @param elems      Array of element symbols or atomic numbers
   * @param positions  Array of 3D positions (Cartesian by default)
   * @param cell       Unit cell definition (see `CellInput` for accepted forms)
   * @param info       Arbitrary metadata
   * @param scaled     If true, treat `positions` as fractional coordinates
   * @param tolerant   If true, accept unknown element symbols without throwing
   */
  constructor(
    elems: (string | number)[],
    positions: number[][] = [],
    cell?: CellInput,
    info?: Record<string, unknown>,
    scaled = false,
    tolerant = false,
  ) {
    const symbols: string[] = [];
    const numbers: number[] = [];

    for (const el of elems) {
      const is_num = typeof el === 'number';
      const a = is_num ? mndtable.getAtomic(el as number) : mndtable.getElement(el as string);
      if (a === null) {
        if (is_num || !tolerant) {
          throw new Error(`Non-existing element "${el}" passed to Atoms`);
        }
        symbols.push(el as string);
        numbers.push(-1);
      } else {
        symbols.push(a.symbol);
        numbers.push(a.number);
      }
    }

    this._arrays = { symbols, numbers };
    this._N = symbols.length;
    this._pbc = [true, true, true];
    this._inv_cell = null;

    // ── Parse cell input ──────────────────────────────────────────────────────
    if (!cell) {
      this._pbc = [false, false, false];
      this._cell = null;
    } else if (typeof cell === 'number') {
      const a = cell;
      this._cell = [
        [a, 0, 0],
        [0, a, 0],
        [0, 0, a],
      ];
    } else if (
      Array.isArray(cell) &&
      cell.length === 2 &&
      Array.isArray(cell[0]) &&
      (cell[0] as unknown[]).length === 3 &&
      Array.isArray(cell[1]) &&
      (cell[1] as unknown[]).length === 3 &&
      typeof (cell[0] as number[])[0] === 'number' &&
      typeof (cell[1] as number[])[0] === 'number' &&
      // Distinguish CellPar from Matrix3x3: angles are not a Vec3 row-vector
      // heuristic: if the second sub-array contains values > 10 it's angles
      (cell[1] as number[]).some((v) => (v as number) > 10)
    ) {
      this._cell = cellparToCell(cell as CellPar);
    } else if (Array.isArray(cell) && cell.length !== 3) {
      throw new Error('Invalid cell passed to set_cell');
    } else {
      this._cell = [];
      const cellArr = cell as (number | null | false | number[])[];
      for (let i = 0; i < 3; i++) {
        const row = cellArr[i];
        if (!row) {
          this._cell.push(null);
          this._pbc[i] = false;
        } else if (typeof row === 'number') {
          const r: Vec3 = [0, 0, 0];
          r[i] = row;
          this._cell.push(r);
        } else if ((row as number[]).length !== 3) {
          throw new Error('Invalid cell passed to set_cell');
        } else {
          this._cell.push(row as Vec3);
        }
      }
    }

    if (this._cell && !(this._cell as (Vec3 | null)[]).includes(null)) {
      this._inv_cell = mjs.inv(this._cell as Matrix3x3) as number[][];
    }

    // ── Validate & store positions ────────────────────────────────────────────
    let resolvedPositions = positions;
    const check_pos = positions.length === this._N && positions.every((p) => p.length === 3);
    if (!check_pos) {
      throw new Error('Invalid positions array passed to Atoms');
    }

    if (scaled) {
      if (this._inv_cell === null) {
        throw new Error('Impossible to use scaled coordinates with non-periodic system');
      }
      resolvedPositions = mjs.multiply(positions, this._cell as Matrix3x3) as number[][];
    }

    this.set_array('positions', resolvedPositions);
    this.info = info ?? {};
  }

  // ── Array accessors ───────────────────────────────────────────────────────

  /** Total number of atoms */
  length(): number {
    return this._N;
  }

  /**
   * Store a per-atom array (must have length equal to the number of atoms).
   */
  set_array(name: string, arr: unknown[]): void {
    if (arr.length !== this._N) throw new Error('Invalid array size');
    this._arrays[name] = arr;
  }

  /** Retrieve a per-atom array by name. */
  get_array(name: string): unknown[] {
    return this._arrays[name];
  }

  get_chemical_symbols(): string[] {
    return deepClone(this._arrays['symbols']) as string[];
  }

  get_atomic_numbers(): number[] {
    return deepClone(this._arrays['numbers']) as number[];
  }

  get_cell(): (Vec3 | null)[] | null {
    return deepClone(this._cell);
  }

  get_inv_cell(): number[][] | null {
    return deepClone(this._inv_cell);
  }

  get_pbc(): [boolean, boolean, boolean] {
    return deepClone(this._pbc);
  }

  get_positions(): number[][] {
    return deepClone(this._arrays['positions']) as number[][];
  }

  /**
   * Return positions in fractional (scaled) coordinates.
   * Performance-critical: uses manual matrix-vector multiply rather than mathjs.
   */
  get_scaled_positions(): number[][] {
    const pos = this._arrays['positions'] as number[][];
    const ic = this._inv_cell as number[][];
    return pos.map((p) => [
      p[0] * ic[0][0] + p[1] * ic[1][0] + p[2] * ic[2][0],
      p[0] * ic[0][1] + p[1] * ic[1][1] + p[2] * ic[2][1],
      p[0] * ic[0][2] + p[1] * ic[1][2] + p[2] * ic[2][2],
    ]);
  }

  // ── CIF reader ────────────────────────────────────────────────────────────

  /**
   * Parse a CIF text string and return a dictionary mapping block names to
   * `Atoms` instances.
   * @param symtol  Distance threshold for deduplicating symmetry-equivalent sites
   */
  static readCif(cif: string, symtol = 1e-3): Record<string, Atoms> {
    const cifdict = parseCif(cif);

    // Only consider blocks that contain atom site data
    const structs: Record<string, CifBlock> = {};
    for (const bname in cifdict) {
      if ('_atom_site_label' in cifdict[bname]) {
        structs[bname] = cifdict[bname];
      }
    }

    const result: Record<string, Atoms> = {};

    for (const sname in structs) {
      const cblock = cifdict[sname];
      const atypes = _atom_types(cblock);
      const asites = _atom_sites(cblock);
      if (!asites) continue;

      const cellpars = _cellpars(cblock);
      const pbc = cellpars !== null;
      let cell: Matrix3x3 | undefined;
      if (pbc) cell = cellparToCell(cellpars!);

      const symbols: string[] = [];
      const labels: string[] = [];
      let positions: number[][] = [];

      for (const site of asites) {
        let symbol = '';
        if (site.type_symbol === undefined) {
          symbol = (site.label as string).split(/[^a-zA-Z]+/)[0];
        } else {
          symbol = site.type_symbol as string;
        }
        if (symbol === '')
          throw new Error(`Could not determine symbol for atom: ${JSON.stringify(site)}`);

        symbols.push(symbol);
        labels.push(site.label as string);

        let p: (number | undefined)[] = [
          site.Cartn_x as number | undefined,
          site.Cartn_y as number | undefined,
          site.Cartn_z as number | undefined,
        ];
        if (p.some((x) => x === undefined)) {
          if (!pbc) throw new Error('Absolute coordinates are necessary without a unit cell');
          p = [site.fract_x as number, site.fract_y as number, site.fract_z as number];
          p = mjs.multiply(p as number[], cell!) as number[];
        }
        positions.push(p as number[]);
      }

      if (pbc) {
        const symops = _symops(cblock);
        if (symops) {
          const fpos = mjs.multiply(positions, mjs.inv(cell!) as number[][]) as number[][];
          let allfpos: number[][] = [];
          let allsyms: string[] = [];
          let alllabs: string[] = [];

          for (let i = 0; i < fpos.length; i++) {
            const p0 = fpos[i];
            const allp = [p0];

            for (const [rot, tr] of symops) {
              const p = mod1(mjs.add(mjs.multiply(rot, p0) as number[], tr) as number[]);
              let eq = false;
              for (const existing of allp) {
                const r = mod1(mjs.subtract(p, existing) as number[]);
                if (shortestPeriodicLength(r) < symtol) {
                  eq = true;
                  break;
                }
              }
              if (!eq) allp.push(p);
            }

            allfpos = allfpos.concat(allp);
            allsyms = allsyms.concat(Array(allp.length).fill(symbols[i]));
            alllabs = alllabs.concat(Array(allp.length).fill(labels[i]));
          }

          // Global deduplication: some CIFs explicitly list atoms that are
          // symmetry-equivalent to others already in the site loop (e.g. both
          // an atom and its inversion partner). Remove duplicates across orbits.
          const uniquefpos: number[][] = [];
          const uniquesyms: string[] = [];
          const uniquelabs: string[] = [];
          for (let i = 0; i < allfpos.length; i++) {
            let dup = false;
            for (const existing of uniquefpos) {
              const r = mod1(mjs.subtract(allfpos[i], existing) as number[]);
              if (shortestPeriodicLength(r) < symtol) {
                dup = true;
                break;
              }
            }
            if (!dup) {
              uniquefpos.push(allfpos[i]);
              uniquesyms.push(allsyms[i]);
              uniquelabs.push(alllabs[i]);
            }
          }

          positions = mjs.multiply(uniquefpos, cell!) as number[][];
          symbols.length = 0;
          symbols.push(...uniquesyms);
          labels.length = 0;
          labels.push(...uniquelabs);
        }
      }

      const a = new Atoms(symbols, positions, cell ?? null, {});
      a.set_array('labels', labels);
      result[sname] = a;

      // suppress unused variable warning for atypes - available for consumers
      void atypes;
    }

    return result;
  }
}

// ── Private CIF extraction helpers ───────────────────────────────────────────

type AnyValue = string | number | undefined;

function _extract_tags(cblock: CifBlock, tags: string[]): (AnyValue[] | null)[] | null {
  const extracted = tags.map((tag) => cblock[tag]);
  if (extracted[0] === undefined) return null;

  const basetype = extracted[0].type;
  const baselen =
    basetype === 'loop'
      ? (extracted[0].value as unknown as import('./parse.js').CifValue[]).length
      : null;

  return extracted.map((x): AnyValue[] | null => {
    if (x === undefined) return null;
    if (x.type !== basetype) return null;
    if (basetype === 'loop') {
      const vals = x.value as import('./parse.js').CifValue[];
      if (vals.length !== baselen) return null;
      return vals.map((v) => v.get_value());
    } else {
      return [(x.value as import('./parse.js').CifValue).get_value()];
    }
  });
}

function _atom_types(cblock: CifBlock): Record<string, Record<string, AnyValue>> | null {
  const tags = ['_atom_type_symbol', '_atom_type_description', '_atom_type_radius_bond'];
  const vals = _extract_tags(cblock, tags);
  if (!vals || !vals[0]) return null;

  const atypes: Record<string, Record<string, AnyValue>> = {};
  for (let i = 0; i < vals[0].length; i++) {
    const sym = vals[0][i] as string;
    atypes[sym] = {};
    for (let j = 1; j < tags.length; j++) {
      if (vals[j]) atypes[sym][tags[j].slice(11)] = vals[j]![i];
    }
  }
  return atypes;
}

function _atom_sites(cblock: CifBlock): Record<string, AnyValue>[] | null {
  const tags = [
    '_atom_site_label',
    '_atom_site_type_symbol',
    '_atom_site_Cartn_x',
    '_atom_site_Cartn_y',
    '_atom_site_Cartn_z',
    '_atom_site_fract_x',
    '_atom_site_fract_y',
    '_atom_site_fract_z',
  ];
  const vals = _extract_tags(cblock, tags);
  if (!vals || !vals[0]) return null;

  return vals[0].map((_, i) => {
    const site: Record<string, AnyValue> = {};
    for (let j = 0; j < tags.length; j++) {
      if (vals[j]) site[tags[j].slice(11)] = vals[j]![i];
    }
    return site;
  });
}

function _cellpars(cblock: CifBlock): CellPar | null {
  const tags = [
    '_cell_length_a',
    '_cell_length_b',
    '_cell_length_c',
    '_cell_angle_alpha',
    '_cell_angle_beta',
    '_cell_angle_gamma',
  ];

  const lengths: number[] = [];
  const angles: number[] = [];

  for (let i = 0; i < 6; i++) {
    const item = cblock[tags[i]] as DataItem | undefined;
    if (!item) return null;
    const val = (item.value as import('./parse.js').CifValue).get_value();
    if (i < 3) lengths.push(val as number);
    else angles.push(val as number);
  }

  if (lengths.some((x) => x === 0)) return null;

  return [lengths as Vec3, angles as Vec3];
}

function _symops(cblock: CifBlock): SymOp[] | null {
  const symopvals =
    (cblock['_space_group_symop_operation_xyz'] as DataItem | undefined) ??
    (cblock['_symmetry_equiv_pos_as_xyz'] as DataItem | undefined);

  const hallsymbol =
    (cblock['_space_group_name_Hall'] as DataItem | undefined) ??
    (cblock['_symmetry_space_group_name_Hall'] as DataItem | undefined);

  if (symopvals) {
    if (
      symopvals.type === 'single' ||
      (symopvals.value as import('./parse.js').CifValue[]).length === 1
    ) {
      return null; // identity only
    }
    const vals = symopvals.value as import('./parse.js').CifValue[];
    return vals.slice(1).map((v) => parseSymOp(v.text!));
  }

  if (hallsymbol) {
    const hval =
      hallsymbol.type === 'single'
        ? (hallsymbol.value as import('./parse.js').CifValue).text
        : (hallsymbol.value as import('./parse.js').CifValue[])[0].text;
    if (hval) return interpretHallSymbol(hval);
  }

  return null;
}
