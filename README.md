# crystcif-parse

A TypeScript parser for Crystallographic Information File (CIF) files.
This module provides a structure to parse the CIF 1.1 data format and
interpret core structural keywords to retrieve crystal structures.

> **v0.3 is a breaking release.** The package is now ESM-only and written in
> TypeScript. See [MIGRATING.md](MIGRATING.md) if you are upgrading from v0.2.

## Features

- Full CIF 1.1 tokeniser and parser
- Structural core dictionary keywords (positions, cell parameters, labels)
- Symmetry operations and Hall symbol interpretation
- TypeScript types / declarations included — no `@types` package needed
- ESM-only; Node ≥ 18 required

### Not supported

- CIF 2.0 syntax
- Non-essential atomic properties (masses, charges, bonds, etc.)

## Installation

```sh
npm install @ccp-nc/crystcif-parse
```

## Usage

```typescript
import { parseCifStructures, Atoms, parseCif } from '@ccp-nc/crystcif-parse';
import { readFileSync } from 'fs';

const text = readFileSync('structure.cif', 'utf8');

// High-level: parse directly into Atoms instances
const structures = parseCifStructures(text);
// { 'block_name': Atoms, ... }

const atoms = structures['my_block'];
console.log(atoms.length());               // number of atoms
console.log(atoms.get_chemical_symbols()); // ['C', 'H', 'O', ...]
console.log(atoms.get_positions());        // [[x,y,z], ...]
console.log(atoms.get_cell());             // [[...], [...], [...]]
console.log(atoms.get_pbc());              // [true, true, true]

// Low-level: access the raw parsed data blocks
const cifdict = parseCif(text);
// { 'block_name': { '_tag': DataItem, ... }, ... }
```

## API

### `parseCifStructures(ciftext: string): Record<string, Atoms>`

Parses a CIF string and returns a dictionary of `Atoms` instances keyed by
data block name. Equivalent to `Atoms.readCif(ciftext)`.

### `parseCif(ciftext: string): CifDict`

Low-level parser. Returns a dictionary of raw data blocks. Each block maps
tag names to `DataItem` objects containing the parsed `CifValue`(s).

### `class Atoms`

A class representing a single crystal structure, inspired by the Python class
of the same name in the
[Atomic Simulation Environment](https://wiki.fysik.dtu.dk/ase/index.html).

**Constructor**

```typescript
new Atoms(
  elems:     (string | number)[],  // element symbols or atomic numbers
  positions: number[][],           // Cartesian [x,y,z] per atom (default [])
  cell?:     CellInput,            // unit cell (see below)
  info?:     Record<string, unknown>,
  scaled?:   boolean,              // treat positions as fractional (default false)
  tolerant?: boolean,              // accept unknown symbols (default false)
)
```

**`cell` input formats (`CellInput`)**

| Value | Meaning |
|---|---|
| `null` / `false` | No periodicity |
| `number` | Cubic cell with that lattice parameter |
| `[a, b, c]` | Orthorhombic cell |
| `[[a,b,c],[α,β,γ]]` | Lengths and angles (degrees) |
| `[[…],[…],[…]]` | Full 3×3 Cartesian cell vectors |
| `[a, null, c]` | Partial periodicity (null axis = non-periodic) |

**Methods**

| Method | Returns |
|---|---|
| `.length()` | `number` — atom count |
| `.get_positions()` | `number[][]` — Cartesian coordinates |
| `.get_scaled_positions()` | `number[][]` — fractional coordinates |
| `.get_chemical_symbols()` | `string[]` |
| `.get_atomic_numbers()` | `number[]` |
| `.get_cell()` | `(Vec3 \| null)[] \| null` |
| `.get_inv_cell()` | `number[][] \| null` |
| `.get_pbc()` | `[boolean, boolean, boolean]` |
| `.get_array(name)` | `unknown[]` — any stored per-atom array |
| `.set_array(name, arr)` | Store a per-atom array |
| `Atoms.readCif(cif, symtol?)` | `Record<string, Atoms>` — static, parse CIF string |

### CLI

```sh
npx validate-cif structure.cif another.cif
```

Validates one or more CIF files and exits with a non-zero code if any fail.

## Exported types

```typescript
import type {
  Vec3, Matrix3x3, CellPar, CellInput,
  SymOp, Token, TokenType,
  CifValue, CifValueType,
  DataItem, SingleDataItem, LoopDataItem,
  CifBlock, CifDict,
} from '@ccp-nc/crystcif-parse';
```

## Development

```sh
npm run build        # compile to dist/ via tsup
npm test             # run Vitest test suite
npm run type-check   # tsc --noEmit
npm run lint         # ESLint
npm run format       # Prettier
```
