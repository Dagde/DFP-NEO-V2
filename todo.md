# Course Ordering Fix

## Summary
Fixed course ordering issue where FIC211 was appearing before FIC210 on the Course Progress page.

## Changes Made

### 1. Updated server.js (root)
- Added numeric sorting logic to GET /api/courses endpoint
- Courses now sort by numeric portion of code (e.g., FIC210 before FIC211)
- Falls back to alphabetical sorting for non-numeric codes

### 2. Updated dfp-neo-platform/server.js
- Applied same numeric sorting logic to maintain consistency
- Ensures both server endpoints return courses in correct order

## How It Works
The sorting logic:
1. Extracts numeric portion from course codes using regex
2. Compares numeric values when both courses have numbers
3. Falls back to alphabetic comparison for non-matching pattern courses

Example:
- "FIC210" → 210
- "FIC211" → 211
- Result: FIC210 comes before FIC211

## Status
✅ Files modified
✅ Changes verified