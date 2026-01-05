# ✅ Railway Deployment Checklist

Use this checklist to ensure everything is configured correctly.

---

## 📋 Pre-Deployment Checklist

- [x] Code is committed to GitHub
- [x] Branch: `feature/comprehensive-build-algorithm`
- [x] Build passes locally
- [x] All TypeScript errors resolved
- [x] Database schema is ready
- [x] Seed script is configured
- [x] Environment variables prepared

---

## 🚀 Railway Setup Checklist

### 1. Project Creation
- [ ] Railway account created/logged in
- [ ] New project created
- [ ] GitHub repository connected
- [ ] Correct branch selected (`feature/comprehensive-build-algorithm`)
- [ ] Initial deployment triggered

### 2. Database Setup
- [ ] PostgreSQL database added to project
- [ ] Database shows "Connected" status (green indicator)
- [ ] `DATABASE_URL` automatically appears in variables

### 3. Environment Variables
- [ ] `NEXTAUTH_SECRET` added
- [ ] `NEXTAUTH_URL` added (with `${{RAILWAY_PUBLIC_DOMAIN}}`)
- [ ] `NODE_ENV` set to `production`
- [ ] All 3 variables show in Variables tab

### 4. Build Configuration
- [ ] Build command: `npm run build` (auto-detected)
- [ ] Start command: `npm run start` (auto-detected)
- [ ] Install command: `npm ci` (auto-detected)
- [ ] Root directory: `/` (default)

### 5. Deployment Status
- [ ] Deployment shows "Success" status
- [ ] No errors in deployment logs
- [ ] Build completed successfully
- [ ] Application started successfully

---

## 🔍 Verification Checklist

### 1. Application Access
- [ ] Railway URL is accessible
- [ ] No "Service Unavailable" errors
- [ ] Homepage loads (redirects to login)

### 2. Login Functionality
- [ ] Login page loads at `/login`
- [ ] Custom visual design appears (metallic plates)
- [ ] Can enter credentials
- [ ] Login with `admin` / `ChangeMe123!` works
- [ ] Redirects to admin panel after login

### 3. Database Verification
- [ ] Admin user exists in database
- [ ] Roles are created (Administrator, Instructor, etc.)
- [ ] Capabilities are seeded
- [ ] No database connection errors

### 4. Admin Panel
- [ ] Admin dashboard loads at `/admin`
- [ ] User management accessible at `/admin/users`
- [ ] Audit logs accessible at `/admin/audit`
- [ ] Can create new users
- [ ] Can edit existing users

### 5. Authentication Features
- [ ] Password change prompt on first login
- [ ] Can change password successfully
- [ ] Logout works correctly
- [ ] Session persists across page refreshes
- [ ] Protected routes require authentication

---

## 🔧 Troubleshooting Checklist

### If Deployment Fails
- [ ] Check Railway logs for specific errors
- [ ] Verify all dependencies in `package.json`
- [ ] Ensure branch is up to date
- [ ] Check for build errors in logs
- [ ] Verify Node.js version compatibility

### If Login Fails
- [ ] Verify `DATABASE_URL` is set
- [ ] Check if seed script ran (look in logs)
- [ ] Confirm PostgreSQL is connected
- [ ] Verify `NEXTAUTH_SECRET` is set
- [ ] Check `NEXTAUTH_URL` is correct

### If Database Issues
- [ ] PostgreSQL shows "Connected" status
- [ ] `DATABASE_URL` exists in variables
- [ ] Seed script completed successfully
- [ ] No migration errors in logs
- [ ] Database tables were created

### If Environment Variable Issues
- [ ] All 3 required variables are set
- [ ] No typos in variable names
- [ ] Values are correctly formatted
- [ ] `NEXTAUTH_URL` uses Railway magic variable
- [ ] Variables are saved (not just drafted)

---

## 📊 Expected Railway Dashboard State

### Services Tab
```
✅ dfp-neo-platform (Next.js app)
   Status: Active
   Deployment: Success
   
✅ PostgreSQL
   Status: Active
   Connection: Connected
```

### Variables Tab
```
✅ DATABASE_URL (auto-configured)
✅ NEXTAUTH_SECRET (hidden)
✅ NEXTAUTH_URL (shows Railway domain)
✅ NODE_ENV = production
```

### Deployments Tab
```
✅ Latest Deployment
   Status: Success
   Duration: ~2-3 minutes
   Logs: No errors
```

### Domains Tab
```
✅ Railway Domain: your-app.up.railway.app
   Status: Active
   
⏳ Custom Domain: dfp-neo.com (optional)
   Status: Pending DNS / Active
```

---

## 🎯 Success Criteria

All of these should be true:

- [x] Railway deployment shows "Success"
- [x] PostgreSQL database is connected
- [x] All environment variables are set
- [x] Application URL is accessible
- [x] Login page loads correctly
- [x] Can login with admin credentials
- [x] Admin panel is accessible
- [x] No console errors in browser
- [x] No errors in Railway logs

---

## 📝 Post-Deployment Tasks

After successful deployment:

- [ ] Change admin password from default
- [ ] Create additional user accounts
- [ ] Test all authentication flows
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring/alerts
- [ ] Document production credentials
- [ ] Test password reset flow
- [ ] Verify audit logging works

---

## 🆘 Common Issues & Solutions

### Issue: "Service Unavailable"
**Solution**: Check Railway logs, verify database connection, ensure all env vars are set

### Issue: Login fails with "Invalid credentials"
**Solution**: Verify seed script ran, check database has admin user, confirm DATABASE_URL is set

### Issue: Build fails
**Solution**: Check logs for specific error, verify dependencies, ensure branch is correct

### Issue: Database not seeded
**Solution**: Add custom start command: `npx prisma db push && npx prisma db seed && npm run start`

### Issue: Environment variables not working
**Solution**: Verify variables are saved (not drafted), check for typos, redeploy after adding

---

## 📞 Support Resources

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs

---

## ✅ Final Verification

Before considering deployment complete:

1. [ ] Can access Railway URL
2. [ ] Login works with admin credentials
3. [ ] Admin panel loads and functions
4. [ ] Database operations work
5. [ ] No errors in logs
6. [ ] All features tested
7. [ ] Performance is acceptable
8. [ ] Security is configured

---

**Once all items are checked, your Railway deployment is complete!** 🎉

**Last Updated**: January 5, 2026