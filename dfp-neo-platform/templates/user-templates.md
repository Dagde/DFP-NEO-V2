# User Templates for GitHub Editing

## 👥 Add New Users - GitHub Method

### Step 1: Edit this file in GitHub
1. Go to your GitHub repository
2. Navigate to `templates/user-templates.md`
3. Click "Edit this file"
4. Add your new user below

### Step 2: Add User Template
Copy and paste this template and fill in the details:

```yaml
# New User Template
- username: "new.username"
  email: "new.user@dfp-neo.com"
  role: "PILOT"  # Options: SUPER_ADMIN, ADMIN, PILOT, INSTRUCTOR, USER
  firstName: "First"
  lastName: "Last"
  notes: "Add any notes about this user"
```

### Step 3: Run Locally
After pushing your changes, run this command locally:
```bash
npx tsx scripts/add-users-from-template.ts
```

## 📋 Current User Requests

### Add New Users Here:

```yaml
# Example:
- username: "mike.pilot"
  email: "mike@dfp-neo.com"
  role: "PILOT"
  firstName: "Mike"
  lastName: "Johnson"
  notes: "Senior pilot, certified on C-17"
```

---

## 🔐 Security Notice
This method allows you to plan users in GitHub while keeping passwords secure. The actual user creation happens locally with secure password handling.