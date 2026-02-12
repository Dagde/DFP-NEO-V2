# Architecture Change Diagram

## Before (Current Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway Project                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           PostgreSQL Database                         │   │
│  │         (Shared by all services)                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                              ↓                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           DFP-NEO Service                            │   │
│  │  ┌──────────────┐    ┌─────────────────┐             │   │
│  │  │ Login Page   │ →  │  Select Page    │ → Apps      │   │
│  │  └──────────────┘    └─────────────────┘             │   │
│  │  (Flight School + App Selection + Authentication)     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           DFP-NEO-V2 Service                         │   │
│  │  (Reconnaissance Edition - has auth issues)          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

User Flow:
1. User visits DFP-NEO
2. Must login → redirected to login page
3. After login → sees app selection
4. Clicks app → redirected to app
5. BUT V2 has auth loop - can't access!

Problems:
❌ Authentication is duplicated across services
❌ V2错误的 V2 app has login loop
❌ Can't access Reconnaissance app
❌ Inconsistent user experience
```

## After (New Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway Project                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           PostgreSQL Database                         │   │
│  │         (Shared by all services)                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                              ↓                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      DFP-NEO-Website Service (NEW!)                   │   │
│  │                                                       │   │
│  │   ┌──────────────┐      ┌─────────────────────┐      │   │
│  │   │ Login Page   │  →   │  Select Page        │      │   │
│   │   │ (Auth only)  │      │  (4 App Tiles)       │      │   │
│  │   └──────────────┘      └─────────────────────┘      │   │
│  │          │                       │                    │   │
│  │          ↓                       ↓                    │   │
│  │    ┌──────────┐           ┌──────────┐              │   │
│  │    │ Flight   │           │ Recon    │              │   │
│  │    │ School   │           │ Edition  │              │   │
│  │    │ Tile     │           │ Tile     │              │   │
│  │    └──────────┘           └──────────┘              │   │
│  │         │                       │                    │   │
│  │         ↓                       ↓                    │   │
│  │    ┌────────────┐      ┌─────────────┐              │   │
│  │    │   REDIRECT │      │   REDIRECT  │              │   │
│  │    │   TO APP   │      │   TO APP    │              │   │
│  │    └────────────┘      └─────────────┘              │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      DFP-NEO Service (MODIFIED!)                     │   │
│  │                                                       │   │
│  │    ┌────────────────────────────────────────────┐    │   │
│  │    │         Flight School App                  │    │   │
│  │    │         (Display Code Only)                │    │   │
│  │    │         NO Authentication                  │    │   │
│  │    │         NO App Selection                   │    │   │
│  │    │         Direct Access                      │    │   │
│  │    └────────────────────────────────────────────┘    │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      DFP-NEO-V2 Service (UNCHANGED)                  │   │
│  │                                                       │   │
│  │    ┌────────────────────────────────────────────┐    │   │
│  │    │       Reconnaissance App                   │    │   │
│  │    │       (Display Code Only)                  │    │   │
│  │    │       NO Authentication                    │    │   │
│  │    │       Direct Access                        │    │   │
│  │    └────────────────────────────────────────────┘    │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

User Flow (New):
1. User visits DFP-NEO-Website
2. User logs in (single authentication point)
3. User sees app selection page
4. User clicks "Flight School" → Redirects to DFP-NEO
5. DFP-NEO shows Flight School app directly (no login needed)
6. User clicks "Reconnaissance" → Redirects to DFP-NEO-V2
7. DFP-NEO-V2 shows Reconnaissance app directly (no login needed)
8. User can switch between apps freely
9. User logs out → Returns to website login

Benefits:
✅ Single authentication point (website)
✅ No authentication duplication
✅ Apps are independent and focused
✅ Easy to add new apps in the future
✅ Better user experience
✅ No login loop issues
```

## Service Changes Summary

### DFP-NEO-Website (NEW - Need to Deploy)
```
What it does:
- User authentication (login)
- App selection (4 tiles)
- Redirects to appropriate apps

What it needs:
- DATABASE_URL (from PostgreSQL)
- NEXTAUTH_URL (production URL)
- NEXTAUTH_SECRET (for security)
- NEXT_PUBLIC_FLIGHT_SCHOOL_URL (redirect target)
- NEXT_PUBLIC_RECONNAISSANCE_URL (redirect target)
```

### DFP-NEO Service (EXISTING - Need to Modify)
```
What it currently does:
- Login page
- App selection page
- Flight School app
- Authentication checks

What it should do (after modification):
- Flight School app ONLY
- NO login page
- NO app selection page
- NO authentication checks
- Direct access

Changes needed:
- Remove login component/page
- Remove select component/page
- Remove authentication middleware
- Make Flight School app load directly
```

### DFP-NEO-V2 Service (EXISTING - No Changes)
```
What it does:
- Reconnaissance app

What it should do:
- Same thing (no changes needed!)

Assumption:
- V2 already shows Reconnaissance app directly
- No authentication needed (or will be removed)
```

## Environment Variables Mapping

```
┌─────────────────────────────────────────────────────────────┐
│              Environment Variables Configuration            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PostgreSQL Service:                                        │
│  ├─ DATABASE_URL (shared with all services)                 │
│                                                             │
│  DFP-NEO-Website (NEW):                                    │
│  ├─ DATABASE_URL (from PostgreSQL)                          │
│  ├─ NEXTAUTH_URL (website's production URL)                 │
│  ├─ NEXTAUTH_SECRET (generated secret)                      │
│  ├─ NEXT_PUBLIC_FLIGHT_SCHOOL_URL (DFP-NEO URL)             │
│  └─ NEXT_PUBLIC_RECONNAISSANCE_URL (DFP-NEO-V2 URL)         │
│                                                             │
│  DFP-NEO (MODIFIED):                                        │
│  └─ (May need DATABASE_URL if it uses the shared DB)        │
│                                                             │
│  DFP-NEO-V2 (UNCHANGED):                                    │
│  └─ DATABASE_URL (already configured)                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## URL Flow Diagram

```
User Experience Flow:

1. Entry Point (Website)
   └─ https://dfp-neo-website-production.up.railway.app
      └─ Shows Login Page

2. After Login
   └─ https://dfp-neo-website-production.up.railway.app/select
      └─ Shows 4 App Tiles

3. Clicking Flight School
   └─ Redirects to: https://dfp-neo-production.up.railway.app
      └─ Shows Flight School App (directly, no login)

4. Clicking Reconnaissance
   └─ Redirects to: https://dfp-neo-v2-production.up.railway.app
      └─ Shows Reconnaissance App (directly, no login)

5. User can:
   - Navigate back to website manually
   - Use browser history to go back
   - Logout button (if added) returns to login
```

## Deployment Order

```
Order of Operations:

1. Deploy DFP-NEO-Website (NEW)
   └─ This breaks nothing, adds new service
   └─ Users can test new website
   └─ Original apps still work as before

2. Modify DFP-NEO Service
   └─ Remove authentication
   └─ Remove app selection
   └─ Make Flight School direct access
   └─ Deploy changes
   └─ Now both apps work through website

3. Update User Links
   └─ Share new website URL
   └─ Users start using website
   └─ Direct app URLs still work (for convenience)

4. Clean Up (Optional)
   └─ Remove old login pages from V2 if they exist
   └─ Update documentation
   └─ Archive old architecture
```

## Quick Reference

### What You Need to Do:

**Step 1: Deploy Website**
- Create Railway service from GitHub repo
- Add 5 environment variables
- Deploy and test

**Step 2: Modify DFP-NEO**
- Remove login page
- Remove select page
- Remove authentication checks
- Deploy and test

**Step 3: Test Everything**
- Login to website
- Select apps
- Verify redirects work
- Verify apps load without login

### What Happens Automatically:

- DFP-NEO-V2: No changes needed (assumption)
- PostgreSQL: Already configured
- Railway: Auto-detects Next.js and builds

### What to Watch Out For:

- Make sure NEXTAUTH_URL matches your production URL
- Copy DATABASE_URL exactly from PostgreSQL service
- Generate a strong NEXTAUTH_SECRET
- Test both apps work after removing auth from DFP-NEO

### Success Indicators:

✅ Website login works
✅ Website shows select page
✅ Clicking Flight School redirects to app
✅ Flight School app loads directly (no login)
✅ Clicking Reconnaissance redirects to app
✅ Reconnaissance app loads directly (no login)
✅ Logout returns to website login
✅ No authentication loop errors