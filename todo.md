# DFP, Staff, Trainee Menu Button Styling Update

## Tasks:
- [x] Examine the current button implementation in the left menu
- [x] Update button styles to match the reference image
- [x] Test the changes and verify the visual appearance

## Design Requirements:
- Black text when not selected
- White text when selected
- Subtle pushed-in effect when selected

## Changes Made:
- Updated `.btn-aluminium-brushed` and `.btn-green-brushed` styles in index.html
- Not selected state: Light gray/silver background with black text
- Selected state: Darker gray background with white text and pushed-in effect (translateY(2px) translateX(1px))
- Rebuilt the application and deployed to V2