# Training Records Export Fixes

## Issues to Fix
- [x] PDF not text-searchable (using html2canvas creates images)
- [x] Individual trainee selection showing 0 records (name matching issue)

## Root Causes Identified

### Issue 1: PDF Not Text-Searchable
- Current implementation uses `html2canvas` to convert HTML to images
- Images are then embedded in PDF, making text non-searchable
- Solution: Use jsPDF's native text/HTML rendering instead of canvas images

### Issue 2: Individual Trainee Filter Not Working
- Problem in line ~320: `selectedTrainees.includes(e.student)`
- Event student names have course suffix: "Edwards, Charlotte – ADF301"
- Trainee names in dropdown don't have suffix: "Edwards, Charlotte"
- The includes() check fails because of suffix mismatch
- Need to normalize names before comparison (like we do for course filter)

## Implementation Plan
- [x] Fix trainee filter to handle name normalization
- [x] Implement text-searchable PDF using jsPDF native methods
- [ ] Test both fixes
- [ ] Build and deploy
- [ ] Commit changes to GitHub