## Tasks

### 1. Fix available aircraft persisting across reset/restart
- [x] Investigate why available aircraft resets to 15 after hard reset
- [x] Ensure the database has the persisted value
- [x] Fix the startup sequence to properly restore the value (use ref to avoid async state issue)

### 2. Add current time to Today's Average display
- [x] Show the current time used to determine if within Day flying window
- [x] Display alongside the flying window times

### 3. Commit and test
- [ ] Commit changes