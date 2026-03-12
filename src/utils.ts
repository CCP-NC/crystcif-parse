/** Utility functions for crystallographic calculations */

/**
 * Deep clone an object via JSON serialisation.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Cross product of two 3-element numeric vectors.
 */
export function cross(
  v1: [number, number, number],
  v2: [number, number, number],
): [number, number, number] {
  return [
    v1[1] * v2[2] - v1[2] * v2[1],
    v1[2] * v2[0] - v1[0] * v2[2],
    v1[0] * v2[1] - v1[1] * v2[0],
  ];
}

/**
 * Euclidean norm of a vector.
 */
export function norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

/**
 * Returns the unit vector of v.
 */
export function unit(v: number[]): number[] {
  const n = norm(v);
  return v.map((x) => x / n);
}

/**
 * Reduce a vector to modulo 1 (interval [0, 1)).
 * Intended for fractional coordinates.
 */
export function mod1(v: number[]): number[] {
  return v.map((x) => {
    x = x % 1;
    return x >= 0 ? x : x + 1;
  });
}

const _deg2rad = Math.PI / 180.0;

/**
 * Convert degrees to radians.
 */
export function degToRad(deg: number): number {
  return deg * _deg2rad;
}

/**
 * Convert radians to degrees.
 */
export function radToDeg(rad: number): number {
  return rad / _deg2rad;
}

/**
 * Returns true if every element in `elems` is found in `arr`.
 */
export function includesAll<T>(arr: T[], elems: T[]): boolean {
  return elems.every((e) => arr.includes(e));
}

/**
 * Shortest periodic distance of a fractional-coordinate displacement
 * vector (already reduced to [0, 1)^3) using minimum-image convention.
 */
export function shortestPeriodicLength(fx: number[]): number {
  let r = norm(fx);
  for (let dx = -1; dx < 2; dx++) {
    for (let dy = -1; dy < 2; dy++) {
      for (let dz = -1; dz < 2; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        const df = [fx[0] + dx, fx[1] + dy, fx[2] + dz];
        r = Math.min(r, norm(df));
      }
    }
  }
  return r;
}
