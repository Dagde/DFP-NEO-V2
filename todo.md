# Fix 413 + FIC211 Color

## Tasks
- [x] Restore to ce0ee32c (commit c5dd9172 pushed)
- [x] Root cause analysis complete: PayloadTooLargeError on POST /api/settings
- [x] Fix 1: server.js - increase express.json limit to 10mb
- [x] Fix 2: Re-apply FIC211 color fixes to all 5 components
- [x] Fix 3: Verify package.json build script writes to correct outDir
- [x] Build bundle locally - SUCCESS (index.js + vendor-react.js + vendor-pdf.js)
- [x] Commit and push - d9fb3956 pushed