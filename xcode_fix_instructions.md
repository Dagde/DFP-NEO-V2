# Critical Xcode Fix Required

## The Problem: Token Storage Key Mismatch

Your app has TWO separate token storage locations that NEVER sync:

### Where LOGIN saves the token:
`CompatibleAuthService.swift` and `CompatibleAuthViewModel.swift` call:
```swift
APIService.shared.setTokens(access: loginData.accessToken, refresh: loginData.refreshToken)
```
This saves to UserDefaults key: `"dfpneo_access_token"`

### Where SCHEDULE reads the token:
`ScheduleViewModel.swift` reads:
```swift
guard let token = DFPTokens.accessToken  // reads "dfp.accessToken"
```
This reads from UserDefaults key: `"dfp.accessToken"` — A COMPLETELY DIFFERENT KEY.

**Result**: After login, the token is saved to `"dfpneo_access_token"` but ScheduleViewModel 
looks for `"dfp.accessToken"` which is ALWAYS nil → "Missing access token. Please log in again."

---

## The Fix (2 options)

### Option A: Fix CompatibleAuthViewModel.swift (Recommended)
Add two lines to the `login()` function to ALSO save tokens to DFPTokens after successful login.

In `ViewModels/CompatibleAuthViewModel.swift`, find this section in the `login()` function:

```swift
// ✅ CRITICAL FIX: Save tokens to APIService so all API calls work
APIService.shared.setTokens(access: resp.accessToken, refresh: resp.refreshToken)
APIService.shared.setUserId(resp.user.userId)

self.currentUser = resp.user
self.isAuthenticated = true
```

**ADD these two lines** immediately after `APIService.shared.setUserId(...)`:
```swift
// ✅ CRITICAL FIX: Also save to DFPTokens so ScheduleViewModel can read them
DFPTokens.accessToken = resp.accessToken
DFPTokens.refreshToken = resp.refreshToken
```

The complete fixed block should look like:
```swift
// ✅ CRITICAL FIX: Save tokens to APIService so all API calls work
APIService.shared.setTokens(access: resp.accessToken, refresh: resp.refreshToken)
APIService.shared.setUserId(resp.user.userId)

// ✅ CRITICAL FIX: Also save to DFPTokens so ScheduleViewModel can read them
DFPTokens.accessToken = resp.accessToken
DFPTokens.refreshToken = resp.refreshToken

self.currentUser = resp.user
self.isAuthenticated = true
```

### Also fix the logout() function:
In `CompatibleAuthViewModel.swift`, in the `logout()` function, add:
```swift
// Also clear DFPTokens
DFPTokens.clear()
```

---

### Option B: Fix ScheduleViewModel.swift
Change ScheduleViewModel to read from APIService instead of DFPTokens.

In `ViewModels/ScheduleViewModel.swift`, this is the relevant section (but ScheduleViewModel
has its own refresh logic that writes back to DFPTokens, so Option A is cleaner).

---

## Why This Happened
- `DFPTokens` (key: `"dfp.accessToken"`) was the ORIGINAL token store
- `APIService` (key: `"dfpneo_access_token"`) was added LATER as a new token store  
- The login code was updated to use `APIService` but `ScheduleViewModel` still reads `DFPTokens`
- The two stores were never synced

---

## Summary of All Issues Found

| Issue | Cause | Fix Location |
|-------|-------|--------------|
| Schedule "Missing access token" | Token key mismatch: login saves to "dfpneo_access_token", schedule reads "dfp.accessToken" | **Xcode: CompatibleAuthViewModel.swift** |
| Unavailability 404 "User not found" | Personnel.userId is FK to User.id (cuid), not User.userId (human-readable) | ✅ Fixed in server.js (commit b9efd71) |
| Schedule "No events" with no response | Schedule endpoint didn't send response when no events found | ✅ Fixed in server.js (commit b9efd71) |

