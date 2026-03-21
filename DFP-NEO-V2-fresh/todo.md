# Live Update for Staff/Trainee Profile Lists

## Problem
- Deleting staff from Staff Database doesn't update Staff Profile list until hard refresh
- Same issue for Trainee Database and Trainee Profile list

## Tasks
- [ ] Investigate how Staff/Trainee Profile lists get their data
- [ ] Implement callback mechanism to refresh profile lists on database changes
- [ ] Update StaffDatabaseTable to trigger refresh
- [ ] Update TraineeDatabaseTable to trigger refresh
- [ ] Build and test the implementation
- [ ] Commit and push changes
