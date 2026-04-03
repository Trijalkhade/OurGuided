---
description: "Use when working with HTML files to ensure proper SEO and social media meta tags, especially Open Graph images"
name: "SEOInstructions"
applyTo: "**/*.html"
---
# SEO and Meta Tag Guidelines for HTML Files

When editing HTML files, always include the following meta tags for proper SEO and social media sharing:

## Required Meta Tags
- `<meta name="description" content="Brief description of the page">`
- `<meta name="keywords" content="relevant, keywords, here">`
- `<meta name="author" content="Author Name">`
- `<meta name="robots" content="index, follow">`

## Open Graph Tags (for social media sharing)
- `<meta property="og:title" content="Page Title">`
- `<meta property="og:description" content="Description for sharing">`
- `<meta property="og:image" content="https://example.com/og-image.png">`
- `<meta property="og:url" content="https://example.com/page">`
- `<meta property="og:type" content="website">`
- `<meta property="og:site_name" content="Site Name">`

## Twitter Card Tags
- `<meta name="twitter:card" content="summary_large_image">`
- `<meta name="twitter:title" content="Page Title">`
- `<meta name="twitter:description" content="Description">`
- `<meta name="twitter:image" content="https://example.com/og-image.png">`

Ensure the OG image is at least 1200x630 pixels and hosted at a valid URL. Use the ImageGeneration prompt to create suitable images.