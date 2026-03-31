# Currency Panel - New Tasks (Continuation)

## New Tasks from User

### Task 1: Redesign CurrencyPanel.tsx to match CurrencyView table layout
- [x] Read current CurrencyPanel.tsx fully
- [x] Read CurrencyView.tsx fully (the layout to copy)
- [x] Rewrite CurrencyPanel.tsx with table layout: Status dot | Currency | Period | Last Event | Expires | Days Rem. (NO Group column)
- [x] Compress table to fit profile flyout panel
- [x] Maintain existing API load/save logic and edit mode

### Task 2: MyDashboard "My Currency" → open Staff profile with currency tab
- [x] Read App.tsx handleSelectMyCurrency and related state/handlers
- [x] Add profileInitialTab state to App.tsx
- [x] Modify handleSelectMyCurrency to open Staff profile flyout with currency tab active
- [x] Add profileInitialTab + onProfileTabConsumed props to InstructorListView
- [x] Add profileInitialTab + onProfileTabConsumed props to InstructorProfileFlyout
- [x] useEffect in InstructorProfileFlyout to activate currency tab when profileInitialTab='currency'

### Task 3: Verify DB connection (PostFlight → CurrencyPanel)
- [x] Confirmed already implemented in previous session (PostFlight saves to DB via PATCH, CurrencyPanel reads from DB via GET)

### Task 4: Build and deploy to Railway
- [x] npm run build passes (785 modules, no errors)
- [x] Git commit 83a03283 pushed to feature/comprehensive-build-algorithm
- [x] Railway will auto-deploy from branch push