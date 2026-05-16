import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const baseOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  target: 'es2020',
  sourcemap: false,
  minify: true,
  treeShaking: true,
  charset: 'utf8',
  legalComments: 'none',
  banner: {
    js: [
      '// Axon Charts v1.1.1',
      '// Licensed under Apache-2.0',
      '// https://github.com/axon-charts/axon-charts'
    ].join('\n')
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

const builds = [
  // IIFE build (browser <script> tag)
  {
    ...baseOptions,
    format: 'iife',
    outfile: 'dist/chart.js',
    globalName: 'AxonCharts',
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
  },
  // ESM build (import / bundler integration)
  {
    ...baseOptions,
    format: 'esm',
    outfile: 'dist/chart.esm.js',
  }
];

if (isWatch) {
  for (const opts of builds) {
    const ctx = await esbuild.context(opts);
    await ctx.watch();
  }
  console.log('Watching for changes...');
} else {
  for (const opts of builds) {
    await esbuild.build(opts);
  }
  console.log('Build complete: dist/chart.js, dist/chart.esm.js');
}
