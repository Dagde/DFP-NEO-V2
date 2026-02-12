# Step-by-Step Railway Deployment Guide

## Part 1: Deploy the New Website Service

### Step 1.1: Log in to Railway
1. Go to https://railway.app
2. Log in to your account
3. Navigate to your existing Railway project (the one with PostgreSQL and DFP-NEO V2)

### Step 1.2: Create New Service for Website
1. Click the "New Service" button (or "+" icon)
2. Select "Deploy from GitHub repo"
3. Find and select `Dagde/DFP-NEO-Website` from the list
4. Click "Deploy Now"

Railway will:
- Automatically detect Next.js framework
- Set default build command: `npm run build`
- Set default start command: `npm start`
- Start initial deployment (this will fail initially - that's okay!)

### Step 1.3: Get DATABASE_URL from PostgreSQL Service
1. In your Railway project, click on the **PostgreSQL** service (not the website)
2. Go to the **Variables** tab
3. Find the `DATABASE_URL` variable
4. Copy its value (it looks like: `postgresql://postgres:SOMEPASSWORD@postgres.railway.internal:5432/railway`)

### Step 1.4: Configure Environment Variables for Website
1. Go back to your new **DFP-NEO-Website** service (click on it)
2. Go to the **Variables** tab
3. Add these variables:

**Variable 1: DATABASE_URL**
```
DATABASE_URL
```
**Value:** Paste the DATABASE_URL you copied from PostgreSQL service

**Variable 2: NEXTAUTH_URL**
```
NEXTAUTH_URL
```
 - **Option A:** If you already see a Railway URL at the top (like `https://dfp-neo-website-production.up.railway.app`), use that
 - **Option B:** If deployment is still running, wait for it to complete, then copy the URL from the top
 - **Value:** `https://your-actual-website-url.up.railway.app`

**Variable 3: NEXTAUTH_SECRET**
```
NEXTAUTH_SECRET
```
**Value:** Generate a secure secret:
- Open your terminal/command prompt
- Run: `openssl rand -base64 32`
- Copy the output and paste it here

**Variable 4: NEXT_PUBLIC_FLIGHT_SCHOOL_URL**
```
NEXT_PUBLIC_FLIGHT_SCHOOL_URL
```
**Value:** Your existing DFP-NEO production URL
- This should be something like: `https://dfp-neo-production.up.railway.app`
- If you don't know it, look for your original DFP-NEO service in Railway and copy its URL

**Variable 5: NEXT_PUBLIC_RECONNAISSANCE_URL**
```
NEXT_PUBLIC_RECONNAISSANCE_URL
```
**Value:** Your V2 production URL
- This should be something like: `https://dfp-neo-v2-production.up.railway.app`
- Find your V2 service and copy its URL

### Step 1.5: Redeploy the Website
1. After adding all environment variables, click the "Redeploy" button
2. Wait 2-3 minutes for deployment to complete
3. You should see "Deployment successful" message

### Step 1.6: Verify Website Deployment
1. Click the URL at the top of the service page
2. You should see the login page
3. Try to log in with your existing credentials
4. If successful, you'll see the select page with 4 app tiles

---

## Part 2: Adjustments to Original DFP-NEO Project

### Understanding the Changes
With the new website architecture, the original DFP-NEO project now needs to:

1. **Remove login/authentication** - The website handles this now
2. **Remove app selection page** - The website handles this now
3. **Remove redirection logic** - The website handles this now
4. **Keep only the Flight School app** - Display code only

### Step 2.1: Identify What to Remove in DFP-NEO

In your original DFP-NEO project, you need to remove:

**Files/Components to Remove:**
1. Login page component
2. Select page component  
3. Authentication middleware or wrapper
4. App routing/redirection logic
5. Any "back to menu" or "logout" buttons in Flight School app

**What to Keep:**
1. Flight School app display code
2. All Flight School functionality
3. All Flight School images and assets
4. Flight School database operations (if any)

### Step 2.2: Make Changes to DFP-NEO (Manual Steps)

**Option A: If DFP-NEO is a simple React app:**
1. Open your DFP-NEO project
2. Find the main entry point (usually `index.html`, `App.tsx`, or `main.js`)
3. Remove any authentication checks
4. Remove any login/select page routing
5. Make the Flight School app render directly on page load

**Example of what to change:**

BEFORE (with authentication):
```javascript
// Check if user is logged in
if (!isAuthenticated) {
  renderLoginPage();
} else {
  renderFlightSchoolApp();
}
```

AFTER (no authentication):
```javascript
// Directly render Flight School app
renderFlightSchoolApp();
```

**Option B: If DFP-NEO has a Next.js structure:**
1. Go to the `app/` or `pages/` directory
2. Remove or modify login and select pages
3. Update the main page to directly show Flight School app
4. Remove any middleware that checks authentication

**Option C: If DFP-NEO is a static HTML site:**
1. Open `index.html`
2. Remove any login forms or authentication scripts
3. Remove any redirect logic
4. Keep only the Flight School app HTML/CSS/JS

### Step 2.3: Deploy Updated DFP-NEO

1. Commit your changes to the DFP-NEO repository
2. Push to GitHub
3. Railway will automatically detect and redeploy
4. Wait for deployment to complete
5. Test that Flight School app loads directly without login

---

## Part 3: Testing the Complete Flow

### Test 1: Website Login
1. Go to website URL (new DFP-NEO-Website)
2. Enter credentials
3. Verify login works

### Test 2: App Selection
1. After login, verify you see the select page
2. Verify all 4 app tiles are visible

### Test 3: Flight School Redirect
1. Click "Flight School Edition" tile
2. Should redirect to DFP-NEO service
3. Should show Flight School app directly (no login)
4. Flight School app should work normally

### Test 4: Reconnaissance Redirect
1. Click "Reconnaissance Edition" tile
2. Should redirect to DFP-NEO-V2 service
3. Should show Reconnaissance app directly (no login)
4. Reconnaissance app should work normally

### Test 5: Logout
1. Click logout button (if exists)
2. Should return to website login page
3. Should not be able to access apps without logging in

---

## Part 4: Troubleshooting

### Website won't deploy
- Check build logs in Railway
- Verify all environment variables are set
- Ensure DATABASE_URL is correct

### Can't login to website
- Verify NEXTAUTH_URL matches your production URL
- Check NEXTAUTH_SECRET is set
- Verify DATABASE_URL is correct and database is running

### Apps redirect but show login
- This means you haven't removed authentication from the app
- Follow Step 2.2 to remove authentication

### Apps show blank page
- Check browser console for errors
- Verify app URLs are correct in environment variables
- Ensure apps are deployed and running

---

## Summary of Changes

### What You're Doing:

1. **Deploying new website service** that handles:
   - User authentication
   - App selection
   - Redirecting to appropriate apps

2. **Modifying original DFP-NEO** to:
   - Remove authentication
   - Remove app selection
   - Show Flight School app directly

3. **Keeping DFP-NEO-V2** unchanged:
   - It already shows Reconnaissance app
   - Website redirects to it

### New Architecture:

```
User Flow:
1. User visits Website
2. User logs in (website handles authentication)
3. User sees app selection page
4. User clicks Flight School → Redirects to DFP-NEO (no login needed)
5. User clicks Reconnaissance → Redirects to DFP-NEO-V2 (no login needed)
6. User logs out → Returns to website login
```

### Services in Railway:

```
Railway Project:
├── PostgreSQL (shared database)
├── DFP-NEO-Website (NEW) → Login + App Selection + Redirects
├── DFP-NEO (modified) → Flight School app only (no auth)
└── DFP-NEO-V2 (unchanged) → Reconnaissance app (no auth)
```

---

## Next Steps After This Guide

1. Complete Part 1: Deploy website
2. Complete Part 2: Modify original DFP-NEO
3. Complete Part 3: Test complete flow
4. Document the new URLs for users
5. Update any bookmarks or links

Need help with any specific step? Let me know!