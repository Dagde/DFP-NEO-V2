# Authorisation View Fix

## Issue
When clicking "Go to Flight Authorisation" from the Duty Supervisor dashboard, users got a "View not found" error.

## Root Cause
The SupervisorDashboard component had a button that called `onNavigate('AUTH')`, but there was no corresponding `case 'AUTH':` in the main App.tsx switch statement that renders views.

The AuthorisationView component was imported but never used:
```typescript
import AuthorisationView from './components/AuthorisationView';
```

## Solution
Added the missing case to the switch statement in App.tsx:

```typescript
case 'AUTH':
    return <AuthorisationView />;
```

This was added just before the `default:` case that returns "View not found".

## Files Modified
- `App.tsx` - Added case 'AUTH' to render AuthorisationView

## Deployment
1. Rebuilt application with `npm run build`
2. Deployed to `dfp-neo-platform/public/flight-school-app/`
3. New build hash: `index-CBNaRbmZ.js`

## Testing
1. Log in to the app
2. Navigate to Supervisor Dashboard
3. Click "Go to Flight Authorisation" button
4. Should now load the Authorisation view instead of showing "View not found"

## Note
The AuthorisationView component currently shows a placeholder:
```typescript
const AuthorisationView = () => {
  return <div>Authorisation View Component</div>;
};
```

This will need to be implemented with the actual authorisation functionality in the future.