# Fix Button Removal - Restore Flight Details Edit Button

## Problem
The ultra-aggressive button removal script removed ALL Edit/Save buttons, including:
- ❌ The legitimate "Edit" button in the Flight Details modal (NEEDED)
- ✅ The debug Edit ✏️ and Save 💾 buttons on bottom left (should be removed)

## Solution
Make the script more specific to only target the debug buttons by:
1. Looking for buttons that contain BOTH text AND emoji (✏️ Edit, 💾 Save)
2. OR buttons with specific styling that matches the debug buttons
3. Preserve all other Edit/Save buttons

## Tasks
- [ ] Update hide-buttons.js to be more selective
- [ ] Test that Flight Details Edit button works
- [ ] Verify debug buttons are still removed
- [ ] Rebuild and deploy