# AUTH_TRUST_HOST Fix for Railway

## Issue Found in Logs
```
[auth][error] UntrustedHost: Host must be trusted. URL was: https://dfp-neo.com/api/auth/session
Read more at https://errors.authjs.dev#untrustedhost
```

## Root Cause
NextAuth v5 requires explicit trust of the host domain in production environments. Without `AUTH_TRUST_HOST=true`, NextAuth rejects all authentication requests as untrusted.

## Solution

### Add AUTH_TRUST_HOST Variable

1. Go to Railway Dashboard
2. Select your DFP-NEO service
3. Go to "Variables" tab
4. Click "+ New Variable"
5. Add:
   - **Variable Name**: `AUTH_TRUST_HOST`
   - **Variable Value**: `true`
6. Click "Add" or "Save"
7. Railway will automatically redeploy

### Final Environment Variables
Your Railway service should have these 4 variables:

```env
DATABASE_URL=postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@postgres.railway.internal:5432/railway
NEXTAUTH_SECRET=c0cf35d7c9bd19e556198fa480ab2003
NEXTAUTH_URL=https://dfp-neo.com
AUTH_TRUST_HOST=true
```

### Why This Is Needed
- NextAuth v5 has stricter security by default
- In production, it requires explicit trust of the host domain
- `AUTH_TRUST_HOST=true` tells NextAuth to trust the domain in `NEXTAUTH_URL`
- This prevents CSRF attacks and ensures requests come from your domain

### After Adding the Variable
1. Wait 1-2 minutes for Railway to redeploy
2. Clear browser cache or use incognito mode
3. Visit https://dfp-neo.com
4. Try logging in with your credentials
5. Should work now!

### Verification
After deployment, check the logs again. You should NO LONGER see:
```
[auth][error] UntrustedHost: Host must be trusted
```

Instead, you should see successful authentication attempts.

## Alternative Solution (If Above Doesn't Work)
If `AUTH_TRUST_HOST=true` doesn't work, you can also try:

```env
NEXTAUTH_URL_INTERNAL=http://localhost:8080
```

This tells NextAuth to use the internal URL for server-side requests while using the public URL for client-side requests.

## Reference
- NextAuth Docs: https://authjs.dev/getting-started/deployment
- Error Reference: https://errors.authjs.dev#untrustedhost