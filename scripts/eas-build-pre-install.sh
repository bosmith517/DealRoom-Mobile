#!/bin/bash
set -e

echo "=== EAS Build Pre-Install Hook ==="
echo "Setting up Mapbox authentication..."

echo "MAPBOX_DOWNLOAD_TOKEN exists: $([ -n "$MAPBOX_DOWNLOAD_TOKEN" ] && echo 'YES' || echo 'NO')"

if [ -n "$MAPBOX_DOWNLOAD_TOKEN" ]; then
  echo "Token starts with: ${MAPBOX_DOWNLOAD_TOKEN:0:10}..."
  echo "Token length: ${#MAPBOX_DOWNLOAD_TOKEN}"
  echo "machine api.mapbox.com login mapbox password ${MAPBOX_DOWNLOAD_TOKEN}" > ~/.netrc
  chmod 600 ~/.netrc
  echo "Mapbox .netrc configured successfully"
else
  echo "WARNING: MAPBOX_DOWNLOAD_TOKEN not set!"
  echo "Maps functionality will use fallback or may not work."
  echo ""
  echo "To enable Mapbox, run:"
  echo "  eas secret:create --name MAPBOX_DOWNLOAD_TOKEN --value sk.YOUR_TOKEN --scope project"
  echo ""
  echo "Continuing build without Mapbox authentication..."
  # Create empty netrc to prevent npm install failures
  touch ~/.netrc
  chmod 600 ~/.netrc
fi
