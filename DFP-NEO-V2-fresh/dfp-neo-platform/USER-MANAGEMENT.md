# DFP-NEO User Management Guide

## 👥 Adding New Users

### Method 1: Command Line (Recommended)

**Quick Add a Single User:**
```bash
npx tsx scripts/add-user.ts <username> <email> <password> <role> <firstName> <lastName>
```

**Examples:**
```bash
# Add a new pilot
npx tsx scripts/add-user.ts "mike.pilot" "mike@dfp-neo.com" "Pilot2024!Secure" "PILOT" "Mike" "Johnson"

# Add a new instructor
npx tsx scripts/add-user.ts "sarah.instructor" "sarah@dfp-neo.com" "Instructor2024!Secure" "INSTRUCTOR" "Sarah" "Davis"

# Add another admin
npx tsx scripts/add-user.ts "james.admin" "james@dfp-neo.com" "Admin2024!Secure" "ADMIN" "James" "Wilson"
```

### Method 2: Edit Setup Script

1. Open `scripts/setup-production-users.ts`
2. Add new user to the `productionUsers` array:
```typescript
{
  username: 'new.pilot',
  email: 'new.pilot@dfp-neo.com',
  password: 'NewPilot2024!',
  role: 'PILOT',
  firstName: 'New',
  lastName: 'Pilot',
}
```
3. Run: `npx tsx scripts/setup-production-users.ts`

### Method 3: Database Direct (Advanced)

```sql
INSERT INTO users (username, email, password, role, firstName, lastName, isActive, createdAt, updatedAt)
VALUES (
  'new.user',
  'new.user@dfp-neo.com',
  '$2a$12$hashedpasswordgoeshere',
  'USER',
  'New',
  'User',
  true,
  NOW(),
  NOW()
);
```

## 🔐 Available User Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| `SUPER_ADMIN` | Full system access | System administrators |
| `ADMIN` | Administrative functions | Department heads |
| `PILOT` | Flight operations | Certified pilots |
| `INSTRUCTOR` | Training functions | Flight instructors |
| `USER` | Basic access | General staff |

## 📋 User Management Commands

### List All Users
```bash
npx prisma studio
# Then navigate to the User table
```

### Update User Password
```bash
npx tsx scripts/add-user.ts <existing-username> <email> <new-password> <role> <firstName> <lastName>
# Will warn if user exists, then you can use Prisma Studio to update
```

### Deactivate User
```sql
UPDATE users SET isActive = false WHERE username = 'user.to.deactivate';
```

### Activate User
```sql
UPDATE users SET isActive = true WHERE username = 'user.to.activate';
```

## 🛡️ Security Best Practices

### Password Requirements
- Minimum 12 characters
- Include uppercase, lowercase, numbers, and special characters
- Example: `Pilot2024!Secure`

### User Management
- Use role-based access control
- Regularly review active users
- Deactivate former employees immediately
- Change passwords regularly

## 🔧 Troubleshooting

### User Already Exists
```
⚠️  User john.pilot already exists!
❌ Use a different username or update existing user.
```
**Solution**: Use a different username or update via Prisma Studio.

### Database Connection Error
**Solution**: Check your DATABASE_URL in .env file

### Permission Denied
**Solution**: Make sure you're running as admin/sudo if needed

## 📊 Example User Scenarios

### Flight School Scenario
```bash
# Chief Flight Instructor
npx tsx scripts/add-user.ts "chief.instructor" "chief@dfp-neo.com" "Chief2024!Secure" "INSTRUCTOR" "Robert" "Brown"

# Senior Pilot
npx tsx scripts/add-user.ts "senior.pilot" "senior@dfp-neo.com" "Senior2024!Secure" "PILOT" "David" "Lee"

# Operations Manager
npx tsx scripts/add-user.ts "ops.manager" "ops@dfp-neo.com" "Ops2024!Secure" "ADMIN" "Jennifer" "Taylor"
```

### Reconnaissance Division Scenario
```bash
# Recon Commander
npx tsx scripts/add-user.ts "recon.commander" "recon@dfp-neo.com" "Recon2024!Secure" "ADMIN" "Michael" "Anderson"

# Mission Pilot
npx tsx scripts/add-user.ts "mission.pilot" "mission@dfp-neo.com" "Mission2024!Secure" "PILOT" "Christopher" "Martinez"
```

---

**Adding users is simple and secure! Choose the method that works best for your workflow.**