# 👨‍💼 Administrator Quick Reference Card

## 🔑 First Time Setup

1. **Login:** http://localhost:3000/login
   - User ID: `admin`
   - Password: (from INITIAL_ADMIN_PASSWORD)
2. **Change Password** (forced on first login)
3. **Access Admin Panel:** http://localhost:3000/admin

---

## 👥 User Management

### Create a New User

**Via Invite Link (Recommended):**
1. Admin Panel → Users → Create User
2. Enter User ID (e.g., "PILOT001")
3. Enter Display Name and Email (optional)
4. Select Permissions Role
5. Choose "Send Invite Link"
6. Copy the generated link
7. Share with user (email, Slack, etc.)
8. User sets their own password via the link

**Via Temporary Password:**
1. Admin Panel → Users → Create User
2. Enter user details
3. Choose "Set Temporary Password"
4. Enter a strong temporary password
5. Share User ID and password with user
6. User must change password on first login

### Edit a User

1. Admin Panel → Users → Click "Edit" on user
2. Update Display Name, Email, or Role
3. Change Status (Active/Disabled/Pending)
4. Click "Update User"

### Force Password Reset

1. Admin Panel → Users → Edit user
2. Click "Force Password Reset"
3. User must change password on next login
4. All their sessions are revoked

### Generate New Invite Link

1. Admin Panel → Users → Edit user
2. Click "Generate New Invite Link"
3. Copy and share the link
4. Previous invite links remain valid until used or expired

### Disable a User

1. Admin Panel → Users → Edit user
2. Change Status to "Disabled"
3. Click "Update User"
4. User cannot login while disabled

### Delete a User

1. Admin Panel → Users → Edit user
2. Click "Delete User"
3. Confirm deletion
4. **Warning:** This cannot be undone!

---

## 🔐 Password Management

### User Forgot Password (with email)

1. User goes to /forgot-password
2. Enters User ID or email
3. Receives reset link via email
4. Clicks link and sets new password
5. All sessions revoked

### User Forgot Password (no email)

**Admin must assist:**
1. Admin Panel → Users → Edit user
2. Click "Generate New Invite Link" OR "Force Password Reset"
3. Share link/temp password with user out-of-band

### Password Requirements

- Minimum 12 characters
- Uppercase + lowercase + number + special character
- Cannot be common passwords (password, 123456, etc.)

---

## 👮 Permissions System

### Roles Available

1. **Administrator**
   - Full system access
   - Can manage users
   - Can view audit logs
   - Access to admin panel

2. **Instructor**
   - Access to launch page
   - Can manage training
   - Can create/edit schedules
   - Can manage personnel

3. **Trainee**
   - Access to launch page only
   - Basic user access

4. **Programmer**
   - Access to launch page
   - Developer tools access
   - Can create/edit schedules

5. **Maintenance**
   - Access to launch page
   - Can edit maintenance records
   - Can manage aircraft

### Capabilities

- `launch:access` - Access Launch page
- `admin:access_panel` - Access Admin Panel
- `users:manage` - Manage users
- `audit:read` - View audit logs
- `training:manage` - Manage training
- `maintenance:edit` - Edit maintenance
- `developer:tools_access` - Developer tools
- `schedule:create` - Create schedules
- `schedule:edit` - Edit schedules
- `schedule:delete` - Delete schedules
- `personnel:manage` - Manage personnel
- `aircraft:manage` - Manage aircraft

---

## 📊 Audit Logs

### View Audit Logs

1. Admin Panel → Audit Logs
2. Filter by:
   - Action Type (login, user created, etc.)
   - User ID
   - Date range
3. Review activity

### Important Events to Monitor

- **login_failure** - Failed login attempts (watch for brute force)
- **login_rate_limited** - Account lockouts
- **user_created** - New users added
- **user_deleted** - Users removed
- **password_changed** - Password changes
- **password_reset_forced** - Admin forced reset
- **sessions_revoked** - Sessions terminated

### Security Alerts

Watch for:
- Multiple failed logins from same IP
- Failed logins outside business hours
- Unusual user creation patterns
- Disabled users attempting login
- Password resets for admin accounts

---

## 🚨 Common Issues & Solutions

### User Can't Login

**Check:**
1. Is User ID correct? (case-insensitive)
2. Is password correct?
3. Is user status "Active"?
4. Has password been set? (not null)
5. Is account locked? (check audit logs for rate_limited)

**Solutions:**
- Generate new invite link
- Set temporary password
- Enable user if disabled
- Wait 15 minutes if rate limited

### User Locked Out

**Cause:** 10 failed login attempts

**Solution:**
- Wait 15 minutes for automatic unlock
- OR restart server (in-memory rate limiting)
- OR (production) clear Redis rate limit key

### Invite Link Not Working

**Check:**
1. Has link expired? (72 hours)
2. Has link been used already? (single-use)
3. Is token in URL correct?

**Solution:**
- Generate new invite link
- Check audit logs for token usage

### User Stuck on Change Password

**Cause:** mustChangePassword flag is true

**Solution:**
1. User must complete password change
2. OR admin can manually set mustChangePassword=false in database (not recommended)

---

## 📞 Support Contacts

### For Users
- Forgot password: Use /forgot-password page
- Account issues: Contact system administrator
- Technical support: support@dfp-neo.com

### For Administrators
- System issues: Check audit logs
- Database issues: Check Prisma logs
- Security concerns: Review failed login attempts
- Feature requests: Contact development team

---

## 🔄 Regular Maintenance Tasks

### Daily
- [ ] Review failed login attempts
- [ ] Check for locked accounts

### Weekly
- [ ] Review audit logs for suspicious activity
- [ ] Check pending users (need password setup)
- [ ] Verify disabled users are intentional

### Monthly
- [ ] Review user permissions
- [ ] Clean up expired tokens (automatic)
- [ ] Update passwords for service accounts
- [ ] Review and update role capabilities

### Quarterly
- [ ] Security audit
- [ ] Review all administrator accounts
- [ ] Update dependencies
- [ ] Test disaster recovery

---

## 🎓 Training Resources

### For New Administrators

1. **First Steps:**
   - Login and change password
   - Explore admin panel
   - Create a test user
   - Review audit logs

2. **User Management:**
   - Practice creating users both ways (invite + temp password)
   - Edit user details
   - Disable and re-enable a user
   - Force password reset

3. **Security:**
   - Understand rate limiting
   - Review audit log events
   - Know when to disable vs delete users
   - Understand role capabilities

### For End Users

1. **Login:**
   - Use your User ID (not email)
   - Contact admin if you forgot password

2. **First Login:**
   - You'll be forced to change password
   - Choose a strong password
   - Remember your new password

3. **Password Reset:**
   - Use /forgot-password if you have email
   - Contact admin if no email on file

---

## 📋 Checklists

### New User Onboarding
- [ ] Create user account
- [ ] Assign appropriate role
- [ ] Generate invite link OR set temp password
- [ ] Share credentials with user
- [ ] Verify user can login
- [ ] Verify user has correct access

### User Offboarding
- [ ] Disable user account (don't delete immediately)
- [ ] Revoke all sessions
- [ ] Review audit logs for user's activity
- [ ] After 90 days, consider deletion
- [ ] Document reason for offboarding

### Security Incident Response
- [ ] Review audit logs for affected timeframe
- [ ] Identify compromised accounts
- [ ] Force password reset for affected users
- [ ] Revoke all sessions
- [ ] Check for unauthorized access
- [ ] Document incident
- [ ] Update security procedures

---

**Quick Links:**
- Login: http://localhost:3000/login
- Admin Panel: http://localhost:3000/admin
- Setup Guide: SETUP_GUIDE.md
- Technical Docs: AUTH_IMPLEMENTATION_STATUS.md

---

**Last Updated:** January 5, 2026