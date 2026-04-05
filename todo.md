# Fix 413 + FIC211 Color

## Tasks
- [x] Restore to ce0ee32c (commit c5dd9172 pushed)
- [x] Root cause analysis complete: PayloadTooLargeError on POST /api/settings
- [ ] Fix 1: server.js - increase express.json limit to 10mb
- [ ] Fix 2: Re-apply FIC211 color fixes to all 5 components
- [ ] Fix 3: Verify package.json build script writes to correct outDir
- [ ] Build bundle locally
- [ ] Commit and push