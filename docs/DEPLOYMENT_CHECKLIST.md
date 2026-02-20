# Deployment Checklist

## Critical Step After Every Build

**ALWAYS verify that `index-v2.html` references the correct JavaScript bundle!**

### The Problem
The Next.js app uses `index-v2.html` as its entry point, but Vite only updates `index.html`. If `index-v2.html` is not manually updated, it will continue referencing an outdated JavaScript bundle and your changes won't be visible.

### How to Check
```bash
# Check what bundle index-v2.html references
grep "index.*\.js" dfp-neo-platform/public/flight-school-app/index-v2.html

# Check what bundle index.html references
grep "index.*\.js" dfp-neo-platform/public/flight-school-app/index.html

# They should match! If they don't, copy index.html to index-v2.html
```

### Manual Fix
```bash
# Update index-v2.html to match index.html
cp dfp-neo-platform/public/flight-school-app/index.html dfp-neo-platform/public/flight-school-app/index-v2.html
cp dfp-neo-v2/public/flight-school-app/index.html dfp-neo-v2/public/flight-school-app/index-v2.html
```

### Automated Solution
The `npm run build` command now automatically updates `index-v2.html` after building. Always use:

```bash
npm run build
```

NOT:

```bash
vite build  # This will NOT update index-v2.html!
```

### Commit Checklist
Before committing, always:

1. ✅ Build with `npm run build`
2. ✅ Verify both `index.html` and `index-v2.html` reference the same JavaScript bundle
3. ✅ Deploy to both `dfp-neo-platform/public/flight-school-app/` and `dfp-neo-v2/public/flight-school-app/`
4. ✅ Commit and push changes

## Troubleshooting
If changes aren't visible after deployment:
1. Check that `index-v2.html` references the correct bundle
2. Force a rebuild: `rm -rf node_modules/.vite dist && npm run build`
3. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)