# 🚀 DFP-NEO Platform - Quick Start Guide

This guide will get you from zero to deployed in under 30 minutes.

## ⚡ Super Quick Deploy (Recommended)

### Step 1: Set Up Vercel Postgres (5 minutes)

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click **Storage** → **Create Database** → **Postgres**
3. Name it `dfp-neo-primary` and create
4. Copy the `DATABASE_URL` connection string
5. Repeat for backup: Create another database named `dfp-neo-backup`
6. Copy the `BACKUP_DATABASE_URL` connection string

### Step 2: Deploy to Vercel (5 minutes)

1. Fork this repository to your GitHub account
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your forked repository
4. Add environment variables:
   ```
   DATABASE_URL=<your-primary-database-url>
   BACKUP_DATABASE_URL=<your-backup-database-url>
   NEXTAUTH_SECRET=<generate-with-command-below>
   NEXTAUTH_URL=https://your-project.vercel.app
   ```
5. Generate NEXTAUTH_SECRET:
   ```bash
   openssl rand -base64 32
   ```
6. Click **Deploy**

### Step 3: Initialize Database (5 minutes)

After deployment completes:

1. In Vercel Dashboard → Your Project → Settings → General
2. Copy your deployment URL
3. Open terminal and run:
   ```bash
   cd dfp-neo-platform
   npm install
   ```
4. Create `.env` file:
   ```bash
   DATABASE_URL="<your-primary-database-url>"
   BACKUP_DATABASE_URL="<your-backup-database-url>"
   NEXTAUTH_SECRET="<your-secret>"
   NEXTAUTH_URL="https://your-project.vercel.app"
   ```
5. Push database schema:
   ```bash
   npx prisma db push
   ```

### Step 4: Create Super Admin (2 minutes)

Run the setup script:
```bash
node scripts/create-super-admin.js
```

Follow the prompts to create your first admin user.

### Step 5: Login & Test (2 minutes)

1. Visit your Vercel URL
2. Login with your super admin credentials
3. Go to Admin Panel
4. Create a test user
5. Test the Flight School version

## 🎯 You're Done!

Your DFP-NEO platform is now live and ready to use!

---

## 🔧 Local Development (Optional)

If you want to develop locally:

1. **Clone and install**
   ```bash
   git clone <your-repo>
   cd dfp-neo-platform
   npm install
   ```

2. **Set up local database** (or use Vercel Postgres)
   ```bash
   # Install PostgreSQL locally or use Docker
   docker run --name dfp-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local database URLs
   ```

4. **Initialize database**
   ```bash
   npx prisma db push
   node scripts/create-super-admin.js
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Custom Domain Setup

1. In Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain (e.g., `dfp-neo.com`)
3. Follow DNS configuration instructions
4. Update `NEXTAUTH_URL` environment variable:
   ```
   NEXTAUTH_URL=https://dfp-neo.com
   ```
5. Redeploy

---

## 📧 Email Setup

### Using Google Workspace (Recommended)

1. Sign up for [Google Workspace](https://workspace.google.com)
2. Add your domain
3. Create email addresses:
   - admin@your-domain.com
   - director@your-domain.com
   - support@your-domain.com
   - marketing@your-domain.com
   - super-admin@your-domain.com
4. Configure forwarding or use Gmail interface

### Using Domain Email Provider

Most domain providers (GoDaddy, Namecheap, etc.) offer email hosting:
1. Go to your domain provider's email section
2. Create the email addresses
3. Set up forwarding to your personal email if needed

---

## 🔐 Security Checklist

After deployment, complete these security steps:

- [ ] Change default super-admin password
- [ ] Enable 2FA on Vercel account
- [ ] Review database access rules
- [ ] Set up monitoring alerts
- [ ] Configure rate limiting (if needed)
- [ ] Review user permissions
- [ ] Set up backup monitoring

---

## 📊 Monitoring & Maintenance

### Check System Health

Visit Vercel Dashboard → Your Project → Analytics to monitor:
- Response times
- Error rates
- User activity
- Database performance

### Backup Verification

The system automatically:
- Syncs to backup database every hour
- Creates daily snapshots
- Fails over to backup if primary is down

Check logs in Vercel Dashboard → Your Project → Logs

---

## 🆘 Troubleshooting

### "Database connection failed"
- Verify DATABASE_URL is correct
- Check database is running
- Ensure IP allowlist includes Vercel IPs

### "Authentication error"
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches your domain
- Clear browser cookies

### "Cannot create user"
- Check database schema is pushed
- Verify super admin exists
- Check user role permissions

### Still having issues?
Email: support@dfp-neo.com

---

## 🎉 Next Steps

1. **Customize branding**: Replace images in `public/images/`
2. **Add users**: Use Admin Panel to create user accounts
3. **Configure settings**: Adjust system settings as needed
4. **Train users**: Share login credentials with your team
5. **Monitor usage**: Check analytics regularly

---

## 📚 Additional Resources

- [Full Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [README](./README.md)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

---

**Need Help?** Contact support@dfp-neo.com

**DFP-NEO Platform** - Built with ❤️ by NinjaTech AI