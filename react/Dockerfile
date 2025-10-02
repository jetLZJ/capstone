FROM node:18-bullseye-slim

WORKDIR /app
COPY package.json .
# Do not COPY package-lock.json from host - it can pin optional native binaries
# built for the host platform and cause failures inside the container. Allow
# npm to generate a lockfile appropriate for the container platform during
# build by running `npm install` here.
# install with legacy-peer-deps to avoid strict peerDependency resolution failures
# during docker builds (common for mixed-version dev deps). Replace with
# stricter dependency resolution in package.json/package-lock.json when ready.
RUN npm install --no-optional --legacy-peer-deps --no-audit --no-fund

# Ensure a fallback for Rollup's native optional binary: install the WASM
# build and create a small shim so require('@rollup/rollup-linux-x64-gnu')
# resolves to the WASM implementation. This avoids runtime errors when the
# optional native package is not present in node_modules for the container.
RUN npm install @rollup/wasm-node --no-optional --no-audit --no-fund --no-save \
 && mkdir -p node_modules/@rollup/rollup-linux-x64-gnu \
 && printf "module.exports = require('@rollup/wasm-node');\n" > node_modules/@rollup/rollup-linux-x64-gnu/index.js

# Ensure Tailwind/PostCSS's lightningcss uses a WASM fallback when the
# platform-specific native addon is not available. Install the wasm package
# and replace the package's `node/index.js` entry with a tiny shim that
# delegates to the WASM implementation. This mirrors the rollup shim above
# and protects the container runtime from host-native binary mismatches.
RUN npm install lightningcss-wasm --no-audit --no-fund --no-save \
 && mkdir -p node_modules/lightningcss/node \
 && printf "module.exports = require('lightningcss-wasm');\n" > node_modules/lightningcss/node/index.js \
 && mkdir -p node_modules/lightningcss \
 && printf "module.exports = require('lightningcss-wasm');\n" > node_modules/lightningcss/lightningcss.linux-x64-gnu.node.js

COPY . .

# Ensure the lightningcss `pkg` entrypoint exists and delegates to the
# WASM transformer. This must run after copying project files in case
# any subsequent copy steps affect node_modules.
RUN mkdir -p node_modules/lightningcss/pkg \
 && printf "module.exports = require('lightningcss-wasm');\n" > node_modules/lightningcss/pkg/index.js || true

EXPOSE 3000

# Ensure node_modules/.bin is in the PATH
ENV PATH /app/node_modules/.bin:$PATH

# Force lightningcss to prefer the WASM transformer inside the container
ENV CSS_TRANSFORMER_WASM=1

# Copy and make the start script executable
COPY start-vite.sh /app/start-vite.sh
RUN chmod +x /app/start-vite.sh

# Run the Vite development server using our script
CMD ["/app/start-vite.sh"]