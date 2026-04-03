---
description: "Generate custom images with specified dimensions, text overlays, and styles for web use like OG images"
name: "ImageGeneration"
argument-hint: "Width x Height, text to overlay, style/theme"
agent: "OGImageFixer"
tools: [execute]
---
Generate a custom image based on the provided parameters:

- Dimensions: {width} x {height} pixels
- Text overlay: "{text}"
- Style/theme: {style}

Use terminal commands (e.g., ImageMagick's convert) to create the image. Ensure the image meets requirements for social media sharing (e.g., minimum 1200x630 for OG images).

Output the command used and confirm the image file location.