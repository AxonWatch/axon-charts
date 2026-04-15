import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'dist/chart.js',
  sourcemap: false, // Disable sourcemap for now
  minify: false, // Disable minification to debug easier
  treeShaking: true,
  globalName: 'KybosCore',
  banner: {
    js: '// Kybos Core v0.1.0'
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
