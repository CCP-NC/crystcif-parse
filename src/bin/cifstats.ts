#!/usr/bin/env node
import { readFile, writeFile } from 'fs/promises';
import { basename } from 'path';
import { parseCif } from '../parse.js';
import { Atoms } from '../cryst.js';

const args = process.argv.slice(2);

const outIndex = args.indexOf('--out');
let outFile = '/dev/stdout';
let files: string[];

if (outIndex !== -1) {
  outFile = args[outIndex + 1];
  files = args.filter((_, i) => i !== outIndex && i !== outIndex + 1);
} else {
  files = args;
}

if (files.length === 0) {
  console.error('Usage: cifstats [--out output.csv] <file> [file ...]');
  process.exit(1);
}

/** Return the scalar string value of a CIF tag, or '' if absent. */
function tag(block: ReturnType<typeof parseCif>[string], key: string): string {
  const item = block[key];
  if (!item) return '';
  if (item.type === 'single') {
    const v = (item.value as { get_value(): string | number | undefined }).get_value();
    return v === undefined || v === '?' || v === '.' ? '' : String(v);
  }
  return '';
}

const rows: string[][] = [['file', 'block', 'formula', 'n_atoms', 'spacegroup']];

await Promise.all(
  files.map(async (f) => {
    const file = basename(f);
    try {
      const data = await readFile(f, 'utf8');
      const cifdict = parseCif(data);
      const atoms = Atoms.readCif(data);

      for (const bname of Object.keys(atoms)) {
        const block = cifdict[bname];
        const formula =
          tag(block, '_chemical_formula_sum') ||
          tag(block, '_chemical_formula_moiety') ||
          tag(block, '_chemical_formula_iupac');
        const nAtoms = atoms[bname].length();
        const spacegroup =
          tag(block, '_symmetry_space_group_name_H-M') ||
          tag(block, '_space_group_name_H-M_alt') ||
          tag(block, '_symmetry_space_group_name_Hall') ||
          tag(block, '_space_group_name_Hall');

        // CSV-escape a field
        const esc = (s: string) => (s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s);
        rows.push([file, bname, formula, String(nAtoms), spacegroup].map(esc));
      }
    } catch (err) {
      const esc = (s: string) => (s.includes(',') ? `"${s}"` : s);
      rows.push([file, '', '', '', esc(String(err))]);
    }
  }),
);

const csv = rows.map((r) => r.join(',')).join('\n') + '\n';
await writeFile(outFile, csv, 'utf8');
