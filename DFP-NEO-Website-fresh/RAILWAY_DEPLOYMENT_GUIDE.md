# DFP-NEO-Website Railway Deployment Guide

## Prerequisites
- Railway account (https://railway.app)
- GitHub repository: https://github.com/Dagde/DFP-NEO-Website
- Shared PostgreSQL database already exists in Railway project

## Step 1: Create New Railway Service

1. Log in to Railway (https://railway.app)
2. Navigate to your existing Railway project (the one with the shared PostgreSQL database)
3. Click "New Service" or "+" button
4. Select "Deploy from GitHub repo"
5. Choose the `Dagde/DFP-NEO-Website` repository
6. Click "Deploy Now"

## Step 2: Configure Build Settings

Railway will automatically detect Next.js, but verify these settings:

**Build Command:**
```
npm run build
```

**Start Command:**
```
npm start
```

**Root Directory:**
```
/
```

## Step 3: Configure Environment Variables

Add the following environment variables to the new website service:

### Database Configuration
```
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@postgres.railway.internal:5432/railway
```
**Important:** Copy this from your existing V2 service's DATABASE_URL variable

### NextAuth Configuration
```
NEXTAUTH_URL=https://your-website-production-url.up.railway.app
NEXTAUTH_SECRET=your-production-secret-key-here
```

**Notes:**
- `NEXTAUTH_URL`: Replace with the actual Railway production URL after deployment
- `NEXTAUTH_SECRET`: Generate a secure secret (use: `openssl rand -base64 32`)

### App URLs
```
NEXT_PUBLIC_FLIGHT_SCHOOL_URL=https://dfp-neo-production.up.railway.app
NEXT_PUBLIC_RECONNAISSANCE_URL=https://dfp-neo-v2-production.up.railway.app
```

## Step 4: Deploy and Test

1. Click "Deploy" to start the deployment
2. Wait for the build to complete (2-3 minutes)
3. Railway will generate a production URL like: `https://dfp-neo-website-production.up.railway.app`
4. Update `NEXTAUTH_URL` with this production URL
5. Redeploy if needed

## Step 5: Verification

### Test the Website
1. Navigate to the production URL
2. You should see the login page
3. Test login with existing credentials (from shared database)

### Test App Redirects
1. Login successfully
2. On the select page, click "Flight School Edition"
3. Should redirect to: https://dfp-neo-production.up.railway.app
4. Click "Reconnaissance Edition"
5. Should redirect to: https://dfp-neo-v2-production.up.railway.app

### Test Authentication
1. Try accessing protected routes directly
2. Should redirect to login if not authenticated
3. Logout should work correctly

## Step 6: Update DNS (Optional)

If you have a custom domain:
1. Go to Railway project settings
2. Click "Domains"
3. Add your custom domain
4. Update DNS records as instructed by Railway
5. Update `NEXTAUTH_URL` to use custom domain

## Troubleshooting

### Build Failures
- Check the build logs in Railway
- Ensure all dependencies are in package.json
- Verify Node.js version (Railway uses latest by default)

### Database Connection Issues
- Verify DATABASE_URL is correct
- Ensure PostgreSQL service is in the same Railway project
- Check that the database is running

### Authentication Issues
- Verify NEXTAUTH_URL matches your production URL
- Ensure NEXTAUTH_SECRET is set
- Check that the database has the User table

### App Redirect Issues
- Verify NEXT_PUBLIC_FLIGHT_SCHOOL_URL and NEXT_PUBLIC_RECONNAISSANCE_URL
- Ensure target apps are accessible
- Check browser console for errors

## Architecture Overview

```
Railway Project:
├── PostgreSQL Database (shared)
├── DFP-NEO Website (NEW)
│   ├── Login page
│   ├── Select page
│   └── Redirects to apps
├── DFP-NEO V2 (existing)
│   └── Reconnaissance Edition
└── DFP-NEO Original (existing)
    └── Flight School Edition
```

## Important Notes

1. **Shared Database:** All three services use the same PostgreSQL database
2. **Independent Apps:** Flight School and Reconnaissance apps are independent
3. **Centralized Auth:** Website handles all authentication
4. **Environment Variables:** Must be set correctly for all services
5. **Branch Deployments:** Can create preview deployments for testing

## Post-Deployment Checklist

- [ ] Website is accessible at production URL
- [ ] Login works with existing credentials
- [ ] Flight School redirect works
- [ ] Reconnaissance redirect works
- [ ] Logout works correctly
- [ ] No console errors in browser
- [ ] Database connections are stable
- [ ] Environment variables are correctly set
- [ ] Custom domain configured (if applicable)