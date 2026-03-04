# DFP-NEO Platform Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (free tier works)
- Your domain name
- Email provider (for email addresses)

## Step 1: Database Setup (Vercel Postgres)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Storage" → "Create Database" → "Postgres"
3. Create TWO databases:
   - `dfp-neo-primary` (Primary database)
   - `dfp-neo-backup` (Backup database)
4. Copy the connection strings for both

## Step 2: GitHub Repository Setup

1. Create a new GitHub repository
2. Push this code to GitHub:
   ```bash
   cd dfp-neo-platform
   git init
   git add .
   git commit -m "Initial commit: DFP-NEO Platform"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/dfp-neo-platform.git
   git push -u origin main
   ```

## Step 3: Vercel Deployment

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure environment variables:
   - `DATABASE_URL`: Your primary database connection string
   - `BACKUP_DATABASE_URL`: Your backup database connection string
   - `NEXTAUTH_URL`: Your domain (e.g., https://dfp-neo.com)
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
5. Click "Deploy"

## Step 4: Database Initialization

After first deployment:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Install Prisma CLI locally:
   ```bash
   npm install -g prisma
   ```
3. Push database schema:
   ```bash
   npx prisma db push
   ```
4. Create the first super admin user:
   ```bash
   npx prisma studio
   ```
   - Open Prisma Studio
   - Create a new User with:
     - username: "super-admin"
     - password: (hash with bcrypt - see below)
     - role: "SUPER_ADMIN"
     - isActive: true

### Generate Password Hash:
```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('your-password-here', 10);
console.log(hash);
```

## Step 5: Domain Configuration

1. In Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Follow Vercel's DNS configuration instructions
4. Update `NEXTAUTH_URL` environment variable to your domain

## Step 6: Email Setup

### Option A: Using Your Domain Email Provider
1. Set up email addresses with your domain provider:
   - admin@your-domain.com
   - director@your-domain.com
   - support@your-domain.com
   - marketing@your-domain.com
   - super-admin@your-domain.com

### Option B: Using Google Workspace (Recommended)
1. Sign up for Google Workspace
2. Add your domain
3. Create email addresses
4. Configure SMTP settings in environment variables

## Step 7: Testing

1. Visit your deployed URL
2. Login with super-admin credentials
3. Go to Admin Panel
4. Create test users
5. Test the Flight School version

## Step 8: Backup Configuration

The backup system runs automatically:
- Every hour: Sync primary → backup database
- On every data write: Automatic failover if primary fails
- Daily: Full snapshot backup

Monitor backup health in Vercel logs.

## Troubleshooting

### Database Connection Issues
- Check environment variables are correct
- Ensure database is in the same region as Vercel deployment
- Verify IP allowlist in database settings

### Authentication Issues
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your domain
- Clear browser cookies and try again

### Deployment Failures
- Check build logs in Vercel
- Ensure all dependencies are in package.json
- Verify TypeScript has no errors

## Security Checklist

- [ ] Change default super-admin password
- [ ] Enable 2FA on Vercel account
- [ ] Set up database backups
- [ ] Configure CORS if needed
- [ ] Review user permissions
- [ ] Set up monitoring/alerts
- [ ] Enable Vercel Analytics
- [ ] Configure rate limiting

## Maintenance

### Weekly Tasks
- Review user activity logs
- Check backup integrity
- Monitor database size

### Monthly Tasks
- Update dependencies
- Review security settings
- Backup database snapshots
- Performance optimization

## Support

For issues or questions:
- Email: support@dfp-neo.com
- Documentation: [Your docs URL]
- GitHub Issues: [Your repo URL]

## Next Steps

1. Migrate your existing DFP-NEO Flight School app
2. Set up automated backups
3. Configure monitoring
4. Train admin users
5. Launch to production users