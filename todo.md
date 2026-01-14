# Fix Dashboard User Display and Event Filtering

## Issues Identified
1. Dashboard welcome message showing wrong user (James Anderson instead of Alexander Burns)
2. Dashboard showing no events (loading wrong user's events)
3. Alexander Burns not included in Staff Schedule (NEO Build function)

## Root Cause
MyDashboard component receives `userName` and `userRank` from `currentUser` which is looked up from mockdata instructors:
```typescript
const currentUser = instructorsData.find(inst => inst.name === currentUserName) || instructorsData[0];
userName={currentUser?.name ? currentUser.name.split(', ').reverse().join(' ') : 'Joe Bloggs'}
```

## Required Fixes
- [ ] Store session user info in state (firstName, lastName, role, userId)
- [ ] Pass real session user info to MyDashboard component
- [ ] Filter events by session user ID (PMKEYS) instead of name
- [ ] Ensure Alexander Burns is included in NEO Build function