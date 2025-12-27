#!/bin/bash
set -e

echo "=== EAS Build Pre-Install Hook ==="
echo "Setting up Mapbox authentication..."

echo "MAPBOX_DOWNLOAD_TOKEN exists: $([ -n "$MAPBOX_DOWNLOAD_TOKEN" ] && echo 'YES' || echo 'NO')"
echo "Token starts with: ${MAPBOX_DOWNLOAD_TOKEN:0:10}..."
echo "Token length: ${#MAPBOX_DOWNLOAD_TOKEN}"

if [ -n "$MAPBOX_DOWNLOAD_TOKEN" ]; then
  echo "machine api.mapbox.com login mapbox password ${MAPBOX_DOWNLOAD_TOKEN}" > ~/.netrc
  chmod 600 ~/.netrc
  echo "Contents of ~/.netrc (first 50 chars):"
  head -c 50 ~/.netrc
  echo "..."
  echo "Mapbox .netrc configured successfully"
else
  echo "ERROR: MAPBOX_DOWNLOAD_TOKEN not set!"
  env | grep -i mapbox || echo "No MAPBOX env vars found"
  exit 1
fi
