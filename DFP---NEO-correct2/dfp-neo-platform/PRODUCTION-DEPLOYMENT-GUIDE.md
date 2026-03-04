# Production Deployment Guide for DFP-NEO

## Current Status
✅ **Sandbox Environment:** Working perfectly on port 9999
❌ **Production Website (dfp-neo.com):** Getting server configuration error

## The Issue
The production website is experiencing a NextAuth configuration error. This typically happens when:
1. Environment variables are not properly set on Railway
2. The NEXTAUTH_URL doesn't match the actual domain
3. The NEXTAUTH_SECRET is missing or invalid

## Step-by-Step Fix for Production

### 1. Update Environment Variables on Railway

You need to set these environment variables in your Railway project:

```bash
# NextAuth Configuration
NEXTAUTH_URL=https://dfp-neo.com
NEXTAUTH_SECRET=your-secure-random-secret-here

# Database URLs (currently using placeholders - will work with mock data)
DATABASE_URL="postgresql://user:password@host:5432/dfp_neo_primary"
BACKUP_DATABASE_URL="postgresql://user:password@host:5432/dfp_neo_backup"
```

**To generate a secure NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 2. Update the .env file in your Railway deployment

Go to your Railway project dashboard:
1. Click on your project
2. Go to "Variables" tab
3. Add/Update these variables:
   - `NEXTAUTH_URL` = `https://dfp-neo.com`
   - `NEXTAUTH_SECRET` = (generate a new one using the command above)

### 3. Verify the Auth Configuration

The current working auth configuration is in `lib/auth/auth.config.ts`. This file:
- ✅ Uses mock user data (no database required)
- ✅ Has proper bcrypt password hashing
- ✅ Includes proper session management
- ✅ Works with the credentials provider

### 4. Deploy the Updated Code

After updating environment variables:
1. Push the latest code to your Railway deployment
2. Railway will automatically redeploy
3. Wait for the deployment to complete

### 5. Test the Production Login

Once deployed, test at:
- Landing page: https://dfp-neo.com
- Login page: https://dfp-neo.com/login

**Test credentials:**
- Username: `admin`
- Password: `admin123`

## Current Working Files

These files are confirmed working in the sandbox and ready for production:

1. **Authentication:**
   - `lib/auth/auth.config.ts` - Main auth configuration with mock users
   - `lib/auth/auth.ts` - NextAuth setup
   - `app/api/auth/[...nextauth]/route.ts` - API route handler

2. **Pages:**
   - `app/login/page.tsx` - Cyberpunk-styled login page
   - `app/select/page.tsx` - App selection page
   - `app/admin/page.tsx` - Admin panel

3. **Mock Data:**
   - Admin user: admin/admin123
   - Pilot user: john.pilot/pilot123
   - Instructor user: jane.instructor/instructor123

## Troubleshooting

If you still get errors after updating environment variables:

### Check Railway Logs
1. Go to Railway dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Click on the latest deployment
5. Check the logs for any error messages

### Common Issues:

**Issue 1: "Invalid provider" error**
- Solution: Make sure the auth configuration is properly deployed

**Issue 2: "NEXTAUTH_URL mismatch"**
- Solution: Verify NEXTAUTH_URL exactly matches your domain (no trailing slash)

**Issue 3: "Session not persisting"**
- Solution: Check that NEXTAUTH_SECRET is set and consistent

## Safety Check Before Connecting to Production

✅ **Safe to deploy:**
- Authentication logic is working in sandbox
- Mock user system is functional
- No database connection required (using mock data)
- All pages are rendering correctly
- Session management is working

⚠️ **Before deploying:**
1. Update NEXTAUTH_URL to production domain
2. Generate and set a secure NEXTAUTH_SECRET
3. Verify environment variables in Railway
4. Test in staging if available

## Next Steps After Successful Deployment

Once the login is working on production:

1. **Database Integration (Optional):**
   - Connect to Railway PostgreSQL
   - Run migrations
   - Create real users
   - Switch from mock data to database

2. **User Management:**
   - Use the admin panel to manage users
   - Create additional accounts as needed

3. **Security Enhancements:**
   - Enable rate limiting
   - Add CAPTCHA if needed
   - Set up monitoring

## Contact Information

If you encounter issues during deployment:
1. Check Railway deployment logs
2. Verify all environment variables are set correctly
3. Ensure the code is properly pushed to Railway
4. Test locally first if possible

---

**Current Sandbox URL (for reference):**
https://9999-f50e58f5-efd2-45fb-9f1f-9911f1134081.sandbox-service.public.prod.myninja.ai

**Production URL:**
https://dfp-neo.com