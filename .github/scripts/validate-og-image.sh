#!/bin/bash

# Validate OG image in HTML files
# This script checks if the og:image URL is accessible

HTML_FILE="frontend/index.html"

if [ -f "$HTML_FILE" ]; then
    OG_IMAGE_URL=$(grep 'og:image' "$HTML_FILE" | sed 's/.*content="\([^"]*\)".*/\1/')

    if [ -n "$OG_IMAGE_URL" ]; then
        echo "Checking OG image: $OG_IMAGE_URL"
        if curl -s --head "$OG_IMAGE_URL" | head -n 1 | grep -q "200"; then
            echo "OG image is accessible."
        else
            echo "Warning: OG image URL is not accessible."
        fi
    else
        echo "Warning: No og:image found in $HTML_FILE"
    fi
else
    echo "HTML file not found: $HTML_FILE"
fi