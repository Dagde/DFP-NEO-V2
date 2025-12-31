# Critical Export Errors - Both Issues Identified

## Error 1: Excel Export - Unrecognized bookType
**Error**: `Error: Unrecognized bookType |excel|`
**Root Cause**: Using `outputFormat` value "excel" directly in filename, but SheetJS expects "xlsx"
**Fix**: Change filename extension from `.excel` to `.xlsx`

## Error 2: PDF/Excel Course Export - No Events
**Error**: `Error: No events to export` when selecting ADF301 course
**Root Cause**: 
- Log shows: `📊 Course filter - Events before filter: 0`
- Events are being filtered out BEFORE the course filter is applied
- The filteredEvents is already empty when course filter runs
- This is why individual trainee works (doesn't use course filter) but course export fails

**Investigation Needed**:
- Check what's filtering out events before the course filter
- Look at the filteredEvents useMemo dependencies
- Verify event filtering logic order

## Implementation Plan
- [ ] Fix Excel filename to use .xlsx extension
- [ ] Debug why filteredEvents is 0 before course filter
- [ ] Fix event filtering order/logic
- [ ] Test both individual and course exports
- [ ] Build and deploy
- [ ] Push to GitHub