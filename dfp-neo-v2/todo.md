# Single Sign-On Implementation for DFP-NEO

## Goal
Implement single sign-on (SSO) between DFP-NEO-Website and DFP-NEO-V2 app so users only need to log in once.

## Architecture
- Website (dfp-neo.com) handles authentication
- V2 app accepts session token from website
- No popup authentication in V2 app

## Tasks

### Phase 1: Website Updates (DFP-NEO-Website)
- [x] Create API route to generate authentication token for V2 app
- [x] Update launch page to pass token to V2 app via URL parameters
- [x] Ensure user data (userId, name, role, location, unit) is included

### Phase 2: V2 App Updates (DFP-NEO-V2)
- [x] Create API route to validate authentication token from website
- [x] Update V2 app to accept token from URL parameters
- [x] Remove popup authentication requirement
- [x] Redirect to login if no valid token

### Phase 3: Testing
- [ ] Test login flow from website to V2 app
- [ ] Verify session persistence
- [ ] Test logout functionality

## Current Status
- Website: ✅ Single sign-on token generation implemented and pushed to main
- V2 App: ✅ Token validation and authentication flow implemented and pushed to feature/comprehensive-build-algorithm
- Next: Deploy both repositories and test the complete flow

## Deployment Instructions

### DFP-NEO-Website (dfp-neo.com)
- Repository: https://github.com/Dagde/DFP-NEO-Website.git
- Branch: main
- Latest commit: cdcaa6b
- Status: ✅ Pushed and ready for deployment

### DFP-NEO-V2
- Repository: https://github.com/Dagde/DFP-NEO-V2.git
- Branch: feature/comprehensive-build-algorithm
- Latest commit: a73b000
- Status: ✅ Pushed and ready for deployment

## Single Sign-On Flow

1. User logs in at dfp-neo.com (website)
2. Website generates authentication token with user data
3. User clicks on V2 app icon on launch page
4. Website redirects to V2 app with authToken and userId in URL
5. V2 app validates token with backend
6. If valid, V2 app loads and stores user data in localStorage
7. If invalid, V2 app redirects back to website login