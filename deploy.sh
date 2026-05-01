#!/bin/bash
set -e

DEV_HTML='<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"/>
    <title>Perin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>'

echo "🔨 Building..."
echo "$DEV_HTML" > index.html
npm run build

echo "📦 Deploying..."
# Remove old asset files first to avoid stale files
rm -f assets/index-*.js assets/index-*.css
# Remove any nested assets folder
rm -rf assets/assets
# Copy fresh assets from dist
cp dist/assets/index-*.js assets/ 2>/dev/null || true
cp dist/assets/index-*.css assets/ 2>/dev/null || true
# Copy index.html for GitHub Pages
cp dist/index.html index.html
cp dist/index.html 404.html

git add -A
git commit -m "${1:-update}"
git push origin main

# Restore dev index.html
echo "$DEV_HTML" > index.html
echo "✅ Deployed!"
