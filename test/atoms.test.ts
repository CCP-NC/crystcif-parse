import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as cryst from '../src/cryst.js';
import * as utils from '../src/utils.js';
import * as symm from '../src/symmetry.js';
import { Atoms } from '../src/cryst.js';
import type { CellPar } from '../src/types.js';
import * as mjs from 'mathjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Helper: assert a 2D matrix is close element-wise
function expectMatClose(actual: number[][], expected: number[][], numDigits = 6): void {
  for (let i = 0; i < expected.length; i++)
    for (let j = 0; j < expected[i].length; j++)
      expect(actual[i][j]).toBeCloseTo(expected[i][j], numDigits);
}

describe('#cell', () => {
  it('should correctly convert from cartesian to axis-and-angles', () => {
    const cell: number[][] = [
      [1, 0, 0],
      [0, 2, 0],
      [0, 3, 4],
    ];
    const abc = cryst.cellToCellpar(cell, true);
    expect(abc[1][0]).toBeCloseTo(Math.acos(6 / 10), 6);
  });

  it('should correctly convert from axis-and-angles to cartesian', () => {
    const abc: CellPar = [
      [3, 1, 1],
      [90, 90, 60],
    ];
    const cell = cryst.cellparToCell(abc, [0, 0, 1], [1, 0, 0]);
    expect(cell[0]).toEqual([3, 0, 0]);
    const expectedRow1 = [0.5, Math.sqrt(3) / 2.0, 0.0];
    for (let i = 0; i < 3; i++) expect(cell[1][i]).toBeCloseTo(expectedRow1[i], 12);
    expect(cell[2]).toEqual([0, 0, 1]);

    // Non-default normals
    const abn = utils.unit([0, 1, 1]);
    const adir = utils.unit([0.5, -1, 1]);
    const cell2 = cryst.cellparToCell(abc, abn, adir);

    expect(mjs.multiply(cell2[2], abn) as number).toBeCloseTo(1, 12);
    expect(mjs.multiply(cell2[0], adir) as number).toBeCloseTo(3, 12);
    expect(mjs.multiply(cell2[1], adir) as number).toBeCloseTo(0.5, 12);
  });

  it('should properly parse symmetry operations', () => {
    const symop = symm.parseSymOp('x,-y+1/2,z');
    expect(symop[0]).toEqual([
      [1, 0, 0],
      [0, -1, 0],
      [0, 0, 1],
    ]);
    expect(symop[1]).toEqual([0, 0.5, 0]);
  });

  it('should correctly interpret Hall symbols', () => {
    const symops = symm.interpretHallSymbol('-P 1');
    expect(symops[1][0]).toEqual([
      [-1, 0, 0],
      [0, -1, 0],
      [0, 0, -1],
    ]);
    expect(symops[1][1]).toEqual([0, 0, 0]);
  });
});

describe('#atoms', () => {
  it('should fail if given non-existent atom species', () => {
    expect(() => new Atoms(['Zz'])).toThrow();
  });

  it('should fail if given arrays of inconsistent length', () => {
    expect(() => new Atoms(['C', 'C'], [[1, 1, 1]])).toThrow();
    expect(() => new Atoms(['C', 'C'], [[1, 1, 1], [1]])).toThrow();
  });

  it('should store positions in array', () => {
    const a = new Atoms(['C'], [[0, 0, 0]]);
    expect((a.get_array('positions') as number[][])[0][0]).toBe(0);
  });

  it('should deal appropriately with cells', () => {
    const a1 = new Atoms([], [], 1);
    expect(a1.get_cell()![0]).toEqual([1, 0, 0]);

    const a2 = new Atoms([], [], [1, 2, 3]);
    expect(a2.get_cell()).toEqual([
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]);

    const a3 = new Atoms([], [], [1, 1, null]);
    expect(a3.get_pbc()).toEqual([true, true, false]);
  });

  it('should compute fractional coordinates correctly', () => {
    const a = new Atoms(
      ['C'],
      [[0.5, 0.5, 1]],
      [
        [1, 1, 0],
        [2, -2, 0],
        [0, 0, 2],
      ],
    );
    expect(a.get_scaled_positions()).toEqual([[0.5, 0, 0.5]]);
  });

  it('should handle fractional coordinates as input', () => {
    const a = new Atoms(
      ['C'],
      [[0.5, 0.5, 0.0]],
      [
        [1, 1, 0],
        [0, 3, 0],
        [0, 0, 1],
      ],
      {},
      true,
    );
    expect(a.get_positions()).toEqual([[0.5, 2.0, 0]]);
  });

  it('should throw for unknown species unless tolerant', () => {
    expect(() => new Atoms(['X'])).toThrow();
    // tolerant mode should not throw
    expect(() => new Atoms(['X'], [[0, 0, 0]], null, undefined, false, true)).not.toThrow();
  });

  it('should correctly parse a cif file', () => {
    const contents = readFileSync(resolve(__dirname, '../examples/example_single.cif'), 'utf8');
    const a = Atoms.readCif(contents)['I'];
    expect(a.length()).toBe(84);
    expect(a.get_pbc()).toEqual([true, true, true]);
  });

  it('should parse a cif file with no _atom_site_type_symbol tags', () => {
    const contents = readFileSync(resolve(__dirname, '../examples/CONGRS_geomopt-out.cif'), 'utf8');
    const a = Atoms.readCif(contents)['CONGRS_geomopt'];
    const species = a.get_chemical_symbols();
    for (let i = 0; i < 80; i++) expect(species[i]).toBe('H');
    for (let i = 80; i < species.length; i++) expect(species[i]).toBe('C');
  });

  it('should not create artefacts from symmetry operations', () => {
    const contents = readFileSync(resolve(__dirname, '../examples/test_symop.cif'), 'utf8');
    const symtol = 1e-3;
    const a = Atoms.readCif(contents, symtol)['TESTSYMOP'];
    const fpos = a.get_scaled_positions();

    for (let i = 0; i < fpos.length - 1; i++) {
      for (let j = i + 1; j < fpos.length; j++) {
        const r = [
          (fpos[j][0] - fpos[i][0]) % 1,
          (fpos[j][1] - fpos[i][1]) % 1,
          (fpos[j][2] - fpos[i][2]) % 1,
        ];
        expect(utils.shortestPeriodicLength(r)).toBeGreaterThan(symtol);
      }
    }
  });

  it('should deduplicate cross-orbit inversion partners (P -1 explicit listing)', () => {
    // dedup_inversion.cif has 4 atoms in the loop: C1, C2, C1B, C2B.
    // C1B is the inversion image of C1; C2B is the inversion image of C2.
    // With 2 P -1 symops, naïve per-atom expansion gives 8 positions.
    // Cross-orbit deduplication must reduce this to 4 unique sites.
    const contents = readFileSync(resolve(__dirname, '../examples/dedup_inversion.cif'), 'utf8');
    const symtol = 1e-3;
    const a = Atoms.readCif(contents, symtol)['DEDUP_INV'];
    expect(a.length()).toBe(4);

    // Also verify no two atoms are within symtol
    const fpos = a.get_scaled_positions();
    for (let i = 0; i < fpos.length - 1; i++) {
      for (let j = i + 1; j < fpos.length; j++) {
        const r = fpos[j].map((v, k) => (v - fpos[i][k]) % 1);
        expect(utils.shortestPeriodicLength(r)).toBeGreaterThan(symtol);
      }
    }
  });

  it('should deduplicate explicitly listed symmetry partners in a P 21/c structure', () => {
    // p21c_dedup.cif lists 8 atoms: 4 unique (C1, C2, C3, H1) plus their
    // inversion partners with a "B" suffix (C1B, C2B, C3B, H1B), which are
    // the op3(-x,-y,-z) images of the originals.  P 21/c has 4 symops, so
    // naïve per-site expansion gives 32 positions; cross-orbit deduplication
    // must reduce this to 4 unique atoms × 4 symops = 16.
    const contents = readFileSync(resolve(__dirname, '../examples/p21c_dedup.cif'), 'utf8');
    const a = Atoms.readCif(contents)['P21C_DEDUP'];
    expect(a.length()).toBe(16);

    // Verify no duplicate sites
    const symtol = 1e-3;
    const fpos = a.get_scaled_positions();
    for (let i = 0; i < fpos.length - 1; i++) {
      for (let j = i + 1; j < fpos.length; j++) {
        const r = fpos[j].map((v, k) => (v - fpos[i][k]) % 1);
        expect(utils.shortestPeriodicLength(r)).toBeGreaterThan(symtol);
      }
    }
  });

  it('should return listed atoms as-is when no symmetry operations are present', () => {
    // no_symop_expansion.cif has P -1 declared but no _symmetry_equiv_pos_as_xyz
    // loop. The 6 listed atoms are the full unit cell; no expansion should occur.
    const contents = readFileSync(
      resolve(__dirname, '../examples/no_symop_expansion.cif'),
      'utf8',
    );
    const a = Atoms.readCif(contents)['NO_SYMOP'];
    expect(a.length()).toBe(6);
    const syms = a.get_chemical_symbols();
    expect(syms.filter((s) => s === 'C').length).toBe(3);
    expect(syms.filter((s) => s === 'H').length).toBe(2);
    expect(syms.filter((s) => s === 'O').length).toBe(1);
  });

  it('should correctly interpret various cell formats', () => {
    // Cubic
    let a = new Atoms(['C'], [[0, 0, 0]], 2.0);
    expect(a.get_cell()).toEqual([
      [2, 0, 0],
      [0, 2, 0],
      [0, 0, 2],
    ]);

    // Orthorhombic
    a = new Atoms(['C'], [[0, 0, 0]], [1, 2, 3]);
    expect(a.get_cell()).toEqual([
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]);

    // Full Cartesian
    a = new Atoms(
      ['C'],
      [[0, 0, 0]],
      [
        [1, 1, 0],
        [0, 2, 0],
        [0, 1, 3],
      ],
    );
    expect(a.get_cell()).toEqual([
      [1, 1, 0],
      [0, 2, 0],
      [0, 1, 3],
    ]);

    // Partial periodicity
    a = new Atoms(['C'], [[0, 0, 0]], [1, null, 1]);
    expect(a.get_pbc()).toEqual([true, false, true]);
    expect(a.get_cell()).toEqual([[1, 0, 0], null, [0, 0, 1]]);

    // Axes and angles
    a = new Atoms(
      ['C'],
      [[0, 0, 0]],
      [
        [1, Math.sqrt(2), 1],
        [90, 90, 45],
      ],
    );
    expectMatClose(a.get_cell() as number[][], [
      [1, 0, 0],
      [1, 1, 0],
      [0, 0, 1],
    ]);
  });
});
