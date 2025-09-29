#!/bin/sh
# Debug info
echo "Current directory: $(pwd)"
echo "Node modules directory: $(ls -la node_modules)"
echo "Vite binary location: $(find /app/node_modules -name vite -type f)"
echo "PATH: $PATH"

# Run Vite directly from node_modules
/app/node_modules/.bin/vite --host 0.0.0.0 --port 3000