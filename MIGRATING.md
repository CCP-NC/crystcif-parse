# Migrating to v0.3

v0.3 rewrites the package in TypeScript and switches to ESM. Most of the
public API is unchanged, but there are a few breaking changes that require
small edits to consumer code.

---

## 1 — ESM-only (most impactful change)

The package now ships as pure ES modules. `require()` no longer works.

**Before (CommonJS)**

```js
const { parseCifStructures, Atoms } = require('@ccp-nc/crystcif-parse');
```

**After (ESM)**

```js
import { parseCifStructures, Atoms } from '@ccp-nc/crystcif-parse';
```

If your project is still CommonJS you have two options:

- Convert to ESM by adding `"type": "module"` to your `package.json` (recommended).
- Use a dynamic `import()` inside an async function:

  ```js
  const { parseCifStructures } = await import('@ccp-nc/crystcif-parse');
  ```

---

## 2 — Node version requirement

The minimum supported Node.js version is now **18**. Versions 12, 14, and 16
are end-of-life and no longer tested.

---

## 3 — mathjs upgrade (7 → 15)

The `mathjs` dependency was upgraded from `^7.6.0` to `^15.1.1`. This only
matters if your code imports `mathjs` alongside this package — the public
API of `crystcif-parse` itself is unaffected.

---

## 4 — Entry point

The published `main` is now the **built output** at `dist/index.js`, not the
source. You should not import from `lib/` directly (those files no longer
exist).

---

## 5 — `Atoms` constructor: `positions` is now optional

`positions` previously had to be passed even for empty structures. It now
defaults to `[]`.

```js
// v0.2 — had to pass empty array explicitly
const a = new Atoms([], [], cell);

// v0.3 — positions can be omitted
const a = new Atoms([], undefined, cell);
// or still pass it explicitly — both work
const a = new Atoms([], [], cell);
```

---

## 6 — TypeScript types

If you were using this package from TypeScript with hand-written ambient
declarations or `@ts-ignore` workarounds, you can remove them. Types are
now bundled in `dist/index.d.ts` and exported automatically.

```typescript
import type { Atoms, CellInput, Vec3, CifDict } from '@ccp-nc/crystcif-parse';
```

---

## 7 — `CifValue.get_value()` return type

The return type is now `number | string | undefined` (it was untyped before).
If you were relying on implicit `any` for this value, TypeScript will now
surface narrowing requirements.

```typescript
const val = item.value.get_value();
if (typeof val === 'number') { /* numeric */ }
if (typeof val === 'string') { /* string  */ }
```

---

## What has not changed

- The full `parseCifStructures` / `parseCif` / `Atoms` public API is intact.
- `Atoms` method names are unchanged (`.get_positions()`, `.get_cell()`, etc.).
- CIF parsing behaviour is unchanged — all existing test CIF files parse
  identically.
- The `validate-cif` CLI command works as before.
