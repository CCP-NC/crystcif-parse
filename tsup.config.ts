import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    validate: 'src/bin/validate.ts',
    cifstats: 'src/bin/cifstats.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  splitting: false,
  tsconfig: 'tsconfig.build.json',
});
