const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function bundleVision() {
  const visionDir = path.join(__dirname, 'lib', 'vision');
  if (!fs.existsSync(visionDir)) {
    fs.mkdirSync(visionDir, { recursive: true });
  }

  console.log('Bundling TensorFlow.js and BlazeFace into lib/vision/...');

  // Bundle TFJS
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, 'node_modules', '@tensorflow', 'tfjs', 'dist', 'tf.es2017.js')],
      outfile: path.join(visionDir, 'tf.min.js'),
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: 'tf',
      platform: 'browser',
      target: ['es2020'],
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });
    console.log('Successfully bundled lib/vision/tf.min.js');
  } catch (err) {
    console.warn('Direct TFJS bundle notice:', err.message);
    // If entry point path differs, check dist files
    const tfPkg = require('@tensorflow/tfjs/package.json');
    const mainFile = path.resolve(__dirname, 'node_modules', '@tensorflow', 'tfjs', tfPkg.main || 'dist/index.js');
    await esbuild.build({
      entryPoints: [mainFile],
      outfile: path.join(visionDir, 'tf.min.js'),
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: 'tf',
      platform: 'browser',
      target: ['es2020']
    });
    console.log('Successfully bundled lib/vision/tf.min.js via main entry');
  }

  // Bundle BlazeFace
  try {
    const blazefacePkg = require('@tensorflow-models/blazeface/package.json');
    const bzMain = path.resolve(__dirname, 'node_modules', '@tensorflow-models', 'blazeface', blazefacePkg.main || 'dist/index.js');
    await esbuild.build({
      entryPoints: [bzMain],
      outfile: path.join(visionDir, 'blazeface.min.js'),
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: 'blazeface',
      platform: 'browser',
      target: ['es2020'],
      external: ['@tensorflow/tfjs']
    });
    console.log('Successfully bundled lib/vision/blazeface.min.js');
  } catch (err) {
    console.error('Failed to bundle BlazeFace:', err);
  }
}

bundleVision();
