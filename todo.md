# Alerts Feature Implementation

## Phase 2: Browser App
- [x] Review FlightDetailModal button structure
- [x] Review FlightDetailModal props interface
- [x] Review App.tsx EventDetailModal usage
- [x] Find CSS classes (index.html)
- [ ] Add CSS for solid green/red alert status bars to index.html
- [ ] Add new props to FlightDetailModal interface (isChanged, alertData, onSendAlert, canSendAlert)
- [ ] Add ALERT button + popout component inside FlightDetailModal.tsx
- [ ] Add alertsData state and handlers in App.tsx
- [ ] Pass new props to EventDetailModal in App.tsx
- [ ] Update FlightTile.tsx to support alertStatus (green/red bar)
- [ ] Pass alertStatus to FlightTile from ScheduleView
- [ ] Build and commit

## Phase 3: iPhone App
- [ ] Create AlertModel.swift
- [ ] Create AlertsViewModel.swift
- [ ] Create AlertsView.swift
- [ ] Update ContentView.swift to add Alerts tab
- [ ] Update APIService.swift with alert API methods

## Phase 4: Deploy
- [ ] Build, commit and push