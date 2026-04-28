# How to Generate and Set NEXTAUTH_SECRET

## Option 1: Using Online Tool (Easiest)

1. Go to this website: https://generate-secret.vercel.app/32
2. Click "Generate" or it will auto-generate
3. Copy the generated string
4. Go to Railway and paste it as NEXTAUTH_SECRET

## Option 2: Using Terminal/Command Line

### On Mac/Linux:
1. Open Terminal
2. Type this command and press Enter:
   ```bash
   openssl rand -base64 32
   ```
3. You'll see output like: `Xj8kP2mN9qR5tY7wZ3vB6nM4lK8hG1fD5sA9pQ2xC0e=`
4. Copy this entire string
5. Go to Railway and paste it as NEXTAUTH_SECRET

### On Windows (PowerShell):
1. Open PowerShell
2. Type this command and press Enter:
   ```powershell
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```
3. Copy the output
4. Go to Railway and paste it as NEXTAUTH_SECRET

### On Windows (Command Prompt):
If you don't have OpenSSL installed, use the online tool (Option 1) instead.

## Option 3: Manual Random String (Quick but less secure)

If you can't use the above methods, you can create a random string:
1. Go to https://www.random.org/strings/
2. Set:
   - Generate: 1 string
   - Length: 32 characters
   - Characters: Alphanumeric
3. Click "Get Strings"
4. Copy the generated string
5. Go to Railway and paste it as NEXTAUTH_SECRET

## How to Set It in Railway

### Step-by-Step:

1. **Go to Railway Dashboard**
   - Visit https://railway.app
   - Log in to your account

2. **Open Your Project**
   - Click on your "dfp-neo" project

3. **Go to Variables**
   - Click on the "Variables" tab (usually on the left sidebar)

4. **Add NEXTAUTH_SECRET**
   - Click "New Variable" or "Add Variable"
   - In the "Key" field, type: `NEXTAUTH_SECRET`
   - In the "Value" field, paste your generated secret
   - Click "Add" or "Save"

5. **Add NEXTAUTH_URL**
   - Click "New Variable" again
   - In the "Key" field, type: `NEXTAUTH_URL`
   - In the "Value" field, type: `https://dfp-neo.com`
   - Click "Add" or "Save"

6. **Wait for Redeploy**
   - Railway will automatically redeploy your app
   - This takes 2-3 minutes
   - You'll see a "Deploying..." status

7. **Test Your Login**
   - Go to https://dfp-neo.com/login
   - Try logging in with admin/admin123

## Example of What It Should Look Like

In Railway Variables tab, you should see:

```
NEXTAUTH_URL          https://dfp-neo.com
NEXTAUTH_SECRET       Xj8kP2mN9qR5tY7wZ3vB6nM4lK8hG1fD5sA9pQ2xC0e=
DATABASE_URL          postgresql://user:password@host:5432/dfp_neo_primary
BACKUP_DATABASE_URL   postgresql://user:password@host:5432/dfp_neo_backup
```

## Important Notes

⚠️ **Do NOT share your NEXTAUTH_SECRET with anyone**
⚠️ **Make sure NEXTAUTH_URL has NO trailing slash** (no `/` at the end)
✅ **The secret should be at least 32 characters long**
✅ **Keep the secret secure - it encrypts your user sessions**

## Troubleshooting

**"I can't find the Variables tab in Railway"**
- Look for "Settings" or "Environment" tab
- It might be under your service/deployment settings

**"Railway isn't redeploying after I add variables"**
- Try manually triggering a redeploy
- Click on "Deployments" and then "Deploy"

**"I generated a secret but it has special characters"**
- That's fine! Copy the entire string including special characters
- Railway will handle it correctly

## Need Help?

If you're having trouble:
1. Take a screenshot of your Railway Variables page
2. Make sure to hide/blur the actual secret values
3. Share the screenshot so I can help verify the setup