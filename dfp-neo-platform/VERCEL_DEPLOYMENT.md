# Vercel Deployment Guide

## Prerequisites
- GitHub account with your repository
- Vercel account (free tier works)

## Step-by-Step Deployment

### 1. Push Code to GitHub
Your code is already in the repository at: `https://github.com/Dagde/DFP---NEO.git`
Branch: `feature/comprehensive-build-algorithm`

### 2. Create Vercel Account
1. Go to https://vercel.com
2. Sign up with GitHub
3. Authorize Vercel to access your repositories

### 3. Import Project
1. Click "Add New..." → "Project"
2. Select your repository: `Dagde/DFP---NEO`
3. **IMPORTANT:** Set Root Directory to `dfp-neo-platform`
4. Framework Preset: Next.js (auto-detected)
5. Click "Deploy"

### 4. Set Up Database
1. In Vercel dashboard, go to Storage tab
2. Click "Create Database"
3. Select "Postgres"
4. Choose a name (e.g., "dfp-neo-db")
5. Select region closest to your users
6. Click "Create"

### 5. Connect Database to Project
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Vercel will automatically add `DATABASE_URL` from the Postgres database
4. Add these additional variables:
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL`: Your Vercel deployment URL (e.g., https://your-app.vercel.app)

### 6. Initialize Database Schema
1. In Vercel dashboard, go to your Postgres database
2. Click "Query" tab
3. Or use the CLI:
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login
   vercel login
   
   # Link project
   vercel link
   
   # Run migrations
   vercel env pull .env.local
   npx prisma db push
   ```

### 7. Create Super Admin User
1. After deployment, go to your Vercel project
2. Click "Settings" → "Functions"
3. Or run locally with production database:
   ```bash
   node scripts/create-super-admin.js
   ```

### 8. Access Your Application
1. Visit your Vercel URL (e.g., https://your-app.vercel.app)
2. You'll see the landing page
3. Login with your super admin credentials
4. Access the admin panel to create more users

## Environment Variables Reference

Required variables:
```
DATABASE_URL=postgresql://...  (Auto-added by Vercel Postgres)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://your-app.vercel.app
```

Optional variables:
```
BACKUP_DATABASE_URL=postgresql://...  (For backup database)
```

## Post-Deployment

### Add Custom Domain (Optional)
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### Monitor Application
1. Check deployment logs in Vercel dashboard
2. Monitor database usage in Storage tab
3. View analytics in Analytics tab

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Ensure root directory is set to `dfp-neo-platform`

### Database Connection Issues
- Verify DATABASE_URL is set correctly
- Check database is in the same region as deployment
- Run `npx prisma db push` to sync schema

### Authentication Issues
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your deployment URL
- Clear browser cookies and try again

## Automatic Deployments

Vercel automatically deploys:
- **Production:** Pushes to `main` branch
- **Preview:** Pushes to other branches (like `feature/comprehensive-build-algorithm`)

To promote preview to production:
1. Merge your feature branch to main
2. Vercel will automatically deploy to production

## Support

For issues:
- Check Vercel documentation: https://vercel.com/docs
- Check Next.js documentation: https://nextjs.org/docs
- Check Prisma documentation: https://www.prisma.io/docs