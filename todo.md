# Training Records Export - Add Weather, NEST, Profile Fields

## New Requirement
Add the following fields to PT051 PDF immediately below the "Overall Grade, Result, DCO" box:
- Weather
- NEST  
- Profile
- Overall comment

These fields are stored in the `overallComments` field of Pt051Assessment, parsed into sections.

## Implementation Plan
- [x] Parse overallComments to extract Weather, NEST, Profile, Overall sections
- [x] Add these fields to PT051 PDF layout below the Overall Grade box
- [x] Match the styling and layout from the PT051View component
- [ ] Test the export with sample data
- [ ] Build and deploy
- [ ] Push to GitHub