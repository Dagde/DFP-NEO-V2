#!/bin/bash
# Script to update index-v2.html after Vite build
# This ensures both index.html and index-v2.html reference the same JavaScript bundles

echo "Updating index-v2.html files..."

# Update dfp-neo-platform
if [ -f "dfp-neo-platform/public/flight-school-app/index.html" ]; then
    cp dfp-neo-platform/public/flight-school-app/index.html dfp-neo-platform/public/flight-school-app/index-v2.html
    echo "✓ Updated dfp-neo-platform/public/flight-school-app/index-v2.html"
else
    echo "✗ dfp-neo-platform/public/flight-school-app/index.html not found"
fi

# Update dfp-neo-v2
if [ -f "dfp-neo-v2/public/flight-school-app/index.html" ]; then
    cp dfp-neo-v2/public/flight-school-app/index.html dfp-neo-v2/public/flight-school-app/index-v2.html
    echo "✓ Updated dfp-neo-v2/public/flight-school-app/index-v2.html"
else
    echo "✗ dfp-neo-v2/public/flight-school-app/index.html not found"
fi

echo "index-v2.html files updated successfully!"