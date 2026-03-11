/** 3D vector */
export type Vec3 = [number, number, number];

/** 3x3 matrix */
export type Matrix3x3 = [Vec3, Vec3, Vec3];

/** Cell in lengths+angles format: [[a,b,c],[alpha,beta,gamma]] */
export type CellPar = [Vec3, Vec3];

/** Symmetry operation as [rotation matrix, translation vector] */
export type SymOp = [number[][], number[]];

/** Token type identifiers produced by the CIF tokenizer */
export type TokenType =
  | 'quotestring'
  | 'semicolontext'
  | 'tag'
  | 'data_headers'
  | 'loop_kw'
  | 'unknown';

/** A single tokenized unit from a CIF file */
export interface Token {
  val: string;
  type: TokenType;
  line: number;
}

// CifValue, DataItem, CifBlock, CifDict are defined in parse.ts to avoid
// circular imports.  Import them directly from there when needed.
