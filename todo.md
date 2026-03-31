# Currency Panel - New Tasks (Continuation)

## New Tasks from User

### Task 1: Redesign CurrencyPanel.tsx to match CurrencyView table layout
- [ ] Read current CurrencyPanel.tsx fully
- [ ] Read CurrencyView.tsx fully (the layout to copy)
- [ ] Rewrite CurrencyPanel.tsx with table layout: Status dot | Currency | Period | Last Event | Expires | Days Rem. (NO Group column)
- [ ] Compress table to fit profile flyout panel
- [ ] Maintain existing API load/save logic and edit mode

### Task 2: MyDashboard "My Currency" → open Staff profile with currency tab
- [ ] Read App.tsx handleSelectMyCurrency and related state/handlers
- [ ] Modify handleSelectMyCurrency to open Staff profile flyout with currency tab active
- [ ] Ensure InstructorProfileFlyout accepts initialTab or similar prop
- [ ] Wire up correctly in App.tsx

### Task 3: Verify DB connection (PostFlight → CurrencyPanel)
- [ ] Confirm already implemented (from summary)

### Task 4: Build and deploy to Railway
- [ ] Run npm run build
- [ ] Git commit and push
- [ ] Verify Railway deployment