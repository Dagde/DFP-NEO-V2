# Environment Variables Reference

## Required Environment Variables

### Database
```
DATABASE_URL=postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
```
**Purpose:** Connection string to shared PostgreSQL database  
**Source:** Copy from existing V2 service in Railway

### NextAuth
```
NEXTAUTH_URL=https://your-website-url.up.railway.app
NEXTAUTH_SECRET=your-secure-secret-here
```
**Purpose:** NextAuth.js configuration  
**NEXTAUTH_URL:** Must match your production Railway URL  
**NEXTAUTH_SECRET:** Generate with `openssl rand -base64 32`

### App URLs
```
NEXT_PUBLIC_FLIGHT_SCHOOL_URL=https://dfp-neo-production.up.railway.app
NEXT_PUBLIC_RECONNAISSANCE_URL=https://dfp-neo-v2-production.up.railway.app
```
**Purpose:** URLs for app redirection from select page  
**Note:** These are public URLs (NEXT_PUBLIC_ prefix makes them available in browser)

## Getting Values from Railway

### DATABASE_URL
1. Go to your Railway project
2. Click on the PostgreSQL service
3. Go to "Variables" tab
4. Copy the value of `DATABASE_URL`
5. Paste into website service's environment variables

### NEXTAUTH_URL
1. Deploy the website service first
2. Railway will generate a URL like: `https://dfp-neo-website-production.up.railway.app`
3. Copy this URL
4. Set as `NEXTAUTH_URL` environment variable
5. Redeploy the service

### App URLs
These should be the production URLs of your existing services:
- Flight School: Check Railway for the original DFP-NEO service URL
- Reconnaissance: Check Railway for the V2 service URL

## Generating NEXTAUTH_SECRET

### Method 1: Using OpenSSL (Recommended)
```bash
openssl rand -base64 32
```

### Method 2: Online Generator
Use an online random string generator to create a 32+ character random string

### Method 3: Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Local Development Environment Variables

For local testing, create a `.env.local` file:

```env
DATABASE_URL="postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="local-development-secret"
NEXT_PUBLIC_FLIGHT_SCHOOL_URL="http://localhost:3001"
NEXT_PUBLIC_RECONNAISSANCE_URL="http://localhost:3002"
```

## Security Notes

1. **Never commit `.env` files to Git** - They're already in `.gitignore`
2. **Use strong secrets** - Generate unique secrets for production
3. **Rotate secrets regularly** - Change NEXTAUTH_SECRET periodically
4. **Limit access** - Only share DATABASE_URL with trusted services
5. **Use HTTPS** - Always use HTTPS URLs in production

## Common Issues

### NEXTAUTH_URL Mismatch
**Problem:** Authentication fails with "Invalid URL" error  
**Solution:** Ensure NEXTAUTH_URL exactly matches your production URL (including https://)

### Database Connection Failed
**Problem:** "Can't reach database server" error  
**Solution:** Verify DATABASE_URL is correct and database is in the same Railway project

### App Redirects Not Working
**Problem:** Clicking app tiles doesn't redirect  
**Solution:** Check NEXT_PUBLIC_FLIGHT_SCHOOL_URL and NEXT_PUBLIC_RECONNAISSANCE_URL are correct

### Build Errors
**Problem:** "Missing environment variable" during build  
**Solution:** Add all required variables before deploying