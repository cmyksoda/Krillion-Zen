#!/bin/bash
set -e

echo "=== Krillion Local Modding/Hosting Setup ==="

# 1. Install dependencies
echo "[1/4] Installing Node.js dependencies..."
npm install

# 2. Mirror the site
echo "[2/4] Mirroring krillion.io..."
mkdir -p krillion-mirror
cd krillion-mirror
# We ignore robots.txt and use -mpEk to get page prerequisites, convert links, and backup originals
wget -mpE https://krillion.io || true

# Strip Vercel ?dpl query params from downloaded filenames so Express can serve them
echo "Cleaning up query strings from filenames..."
find krillion.io -type f -name "*\?*" -exec bash -c 'mv "$0" "${0%%\?*}"' {} \;

# Manually fetch canvas background images that wget misses
echo "[2.5/4] Fetching missing canvas backgrounds and tier icons..."
mkdir -p krillion.io/gen/optimized/v1/
cd krillion.io/gen/optimized/v1/
curl -sO https://krillion.io/gen/optimized/v1/bg-sky.webp
curl -sO https://krillion.io/gen/optimized/v1/bg-top.webp
curl -sO https://krillion.io/gen/optimized/v1/bg-mid.webp
curl -sO https://krillion.io/gen/optimized/v1/bg-trench.webp
cd ../../../../

# Manually fetch tier fish icons (also missed by wget)
mkdir -p krillion.io/tiers/
cd krillion.io/tiers/
for fish in plankton schooler schooler-gold tooclever rare rare-gold deepcut deepcut-gold krillion krillion-gold miss; do
    curl -sO "https://krillion.io/tiers/${fish}.png" || true
done
cd ../../
cd ..

# 3. Apply mod patches (remove footer, timer, inject auth, etc.)
echo "[3/4] Applying JS mods..."
node apply_mods.js

# 4. Prepare DB file to avoid Docker creating a directory for the volume
echo "[4/4] Creating user database..."
touch users.db

echo "=== Setup Complete! ==="
echo "You can now run 'docker-compose up -d' to run the server."
