# Training Records Export - PT051 PDF Layout Updates

## Layout Changes Required
- [x] Overall Comment: make full width of page
- [x] NEST box: make small (for single number like 0.3 hrs)
- [x] Profile: move to same line as Weather
- [x] QFI comment: remove from bottom of page
- [x] Flight description: add below flight number (BGF8)

## Implementation Plan
- [x] Update comment box layout in renderPT051ToPDF
- [x] Get flight description from syllabus details
- [x] Remove QFI comments section at bottom
- [ ] Build and deploy
- [ ] Push to GitHub