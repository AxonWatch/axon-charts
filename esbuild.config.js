import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'dist/chart.js',
  sourcemap: false, // Disable sourcemap for production build
  minify: true, // Enable minification for production
  treeShaking: true,
  globalName: 'AxonCharts',
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  charset: 'utf8',
  legalComments: 'none', // Remove license comments from code (keep banner)
  banner: {
    js: [
      '// Axon Charts v1.0.0',
      '// Licensed under Apache-2.0',
      '// https://github.com/axon-charts/axon-charts'
    ].join('\n')
  },
  // Make exports available on global object
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

if (isWatch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(options);
  console.log('Build complete: dist/chart.js');
}
