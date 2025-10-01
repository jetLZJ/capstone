// create-shims.js
// This script is run at postinstall to create small shim files so
// optional native bindings for rollup/lightningcss will resolve to WASM
// fallbacks when the native addon does not exist for the current platform.

import fs from 'fs';
import path from 'path';

const root = process.cwd();
const nodeModules = path.join(root, 'node_modules');

function safeWrite(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    console.log('wrote', filePath);
  } catch (e) {
    console.warn('failed to write', filePath, e && e.message);
  }
}

// rollup shim
safeWrite(
  path.join(nodeModules, '@rollup', 'rollup-linux-x64-gnu', 'index.js'),
  "module.exports = require('@rollup/wasm-node');\n"
);

// lightningcss shims
safeWrite(
  path.join(nodeModules, 'lightningcss', 'node', 'index.js'),
  "module.exports = require('lightningcss-wasm');\n"
);

safeWrite(
  path.join(nodeModules, 'lightningcss', 'lightningcss.linux-x64-gnu.node.js'),
  "module.exports = require('lightningcss-wasm');\n"
);

safeWrite(
  path.join(nodeModules, 'lightningcss', 'pkg', 'index.js'),
  "module.exports = require('lightningcss-wasm');\n"
);

console.log('shims creation done');
