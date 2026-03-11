export { Atoms, cellToCellpar, cellparToCell, type CellInput } from './cryst.js';
export {
  parseCif,
  tokenize,
  parseValue,
  parseDataBlocks,
  parseDataItems,
  CifValue,
} from './parse.js';
export type {
  CifValueType,
  DataItem,
  SingleDataItem,
  LoopDataItem,
  CifBlock,
  CifDict,
} from './parse.js';
export type { Vec3, Matrix3x3, CellPar, SymOp, Token, TokenType } from './types.js';

import { Atoms } from './cryst.js';

/**
 * Convenience wrapper: parse a CIF string and return a dict of `Atoms`
 * instances keyed by data-block name.
 */
export function parseCifStructures(ciftext: string): Record<string, Atoms> {
  return Atoms.readCif(ciftext);
}
