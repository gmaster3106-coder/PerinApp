#!/bin/bash
set -e

echo "🔨 Building..."
npm run build

echo "📦 Copying built files to root..."
cp -r dist/assets ./assets 2>/dev/null || true
cp dist/index.html ./index.html.built

# Only overwrite index.html for GitHub Pages — keep src version separate
cp dist/index.html ./404.html

# Restore the dev index.html immediately after
cat > index.html << 'DEVEOF'
<!DOCTYPE html>
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
</html>
DEVEOF

# Use the built index.html for git but restore dev after push
cp index.html.built index.html
git add -A
git commit -m "${1:-Deploy}"
git push origin main

# Restore dev index.html
cat > index.html << 'DEVEOF'
<!DOCTYPE html>
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
</html>
DEVEOF

rm -f index.html.built
echo "✅ Deployed! Dev index.html restored."
