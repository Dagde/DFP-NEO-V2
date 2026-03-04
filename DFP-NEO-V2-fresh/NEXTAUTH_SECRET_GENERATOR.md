# Generate Strong NEXTAUTH_SECRET

## Quick Generation Methods

### Method 1: Online Generator (Easiest)
Visit: https://generate-secret.vercel.app/32

Copy the generated secret and paste it into Railway's NEXTAUTH_SECRET variable.

### Method 2: Terminal Command
If you have access to a terminal with OpenSSL:
```bash
openssl rand -base64 32
```

### Method 3: Node.js
If you have Node.js installed:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Method 4: Python
If you have Python installed:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Steps to Update in Railway

1. Generate a new secret using one of the methods above
2. Go to Railway dashboard → Your service → Variables tab
3. Click on NEXTAUTH_SECRET variable
4. Replace the current value with the new generated secret
5. Save the variable
6. Wait for automatic redeployment (1-2 minutes)
7. Clear browser cache or use incognito mode
8. Try logging in again at https://dfp-neo.com

## Example Strong Secret
Here's an example of what a strong NEXTAUTH_SECRET looks like:
```
Kix2f3VqB7mN9pL4wR8sT1yU6hG5jD0aE3cF7bV2nM8xZ4qW9kP1rY5tI3oA6sD
```

Your secret should be:
- At least 32 characters long
- Random and unpredictable
- Base64 encoded (letters, numbers, +, /, =)

## Current Issue
Your current NEXTAUTH_SECRET (`c0cf35d7c9bd19e556198fa480ab2003`) appears to be a hex string which might not be strong enough. Generate a new base64 encoded secret for better security.