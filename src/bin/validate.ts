#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { Atoms } from '../cryst.js';

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('Usage: validate-cif <file> [file ...]');
  process.exit(1);
}

let hasError = false;

await Promise.all(
  files.map(async (f) => {
    try {
      const data = await readFile(f, 'utf8');
      Atoms.readCif(data);
      console.log(`✓  ${f}`);
    } catch (err) {
      console.error(`✗  ${f}: ${err}`);
      hasError = true;
    }
  }),
);

if (hasError) process.exit(1);
