# DFP-NEO iOS App - Quick Setup Guide

## 🎯 Getting Started in 5 Minutes

### Step 1: Open the Project
```bash
cd DFP-NEO-iOS
open DFPNeo.xcodeproj
```

### Step 2: Configure Your Organization
1. Click on "DFPNeo" project in the left sidebar
2. Select "DFPNeo" target
3. Go to "Signing & Capabilities" tab
4. Change Bundle Identifier from `com.dfpneo.mobile` to `com.YOUR_ORG.dfpneo.mobile`
5. Select your Team from the dropdown

### Step 3: Add the Logo
1. In Xcode, open `Assets.xcassets`
2. Right-click in the left panel → "New Image Set"
3. Name it: `dfp-neo-logo`
4. Drag the provided `Logo.png` into the 1x slot
5. In the Attributes Inspector (right panel):
   - Set "Render As" to "Original Image"

### Step 4: Configure API Endpoint
1. Open `DFPNeo/Services/APIService.swift`
2. Find line 14:
   ```swift
   private let baseURL = "https://dfp-neo.com/api"
   ```
3. Change to your backend URL (keep the `/api` suffix)

### Step 5: Run on Your iPhone
1. Connect your iPhone to your Mac with a cable
2. Unlock your iPhone
3. When prompted, tap "Trust This Computer"
4. In Xcode, select your iPhone from the device dropdown (top left)
5. Click the Play button (▶️) or press `Cmd + R`
6. Wait for the build to complete
7. On your iPhone:
   - Go to Settings → General → VPN & Device Management
   - Tap on your developer profile
   - Tap "Trust [Your Name]"
8. Launch the DFP-NEO app on your iPhone

## 🔧 Configuration Checklist

- [ ] Bundle Identifier updated
- [ ] Development Team selected
- [ ] Logo added to Assets
- [ ] API endpoint configured
- [ ] App builds successfully
- [ ] App runs on device
- [ ] Developer profile trusted on device

## 🎨 Optional: Customize App Icon

1. Open `Assets.xcassets`
2. Click on `AppIcon`
3. Drag your icon images into the appropriate slots:
   - iPhone App: 60pt (2x and 3x)
   - iPhone Settings: 29pt (2x and 3x)
   - iPhone Spotlight: 40pt (2x and 3x)
   - App Store: 1024pt (1x)

Recommended: Use the DFP-NEO logo with a black background.

## 🔐 Backend API Requirements

Your DFP-NEO backend must provide these endpoints:

### Authentication
```
POST /api/auth/login
Body: { "userId": "string", "password": "string" }
Response: { "accessToken": "string", "refreshToken": "string", "user": {...}, "expiresIn": number }

POST /api/auth/refresh
Body: { "refreshToken": "string" }
Response: { "accessToken": "string", "expiresIn": number }

POST /api/auth/logout
Headers: Authorization: Bearer {token}
Response: { "success": true }

GET /api/auth/me
Headers: Authorization: Bearer {token}
Response: { "id": "string", "userId": "string", ... }
```

### Schedule
```
GET /api/schedule?date=YYYY-MM-DD
Headers: Authorization: Bearer {token}
Response: {
  "schedule": {
    "id": "string",
    "date": "YYYY-MM-DD",
    "isPublished": boolean,
    "events": [...],
    "serverTime": "ISO8601"
  }
}
```

### Unavailability
```
GET /api/unavailability/reasons
Headers: Authorization: Bearer {token}
Response: {
  "reasons": [
    { "id": "string", "code": "string", "description": "string", "requiresApproval": boolean }
  ]
}

POST /api/unavailability/quick
Headers: Authorization: Bearer {token}
Body: { "date": "YYYY-MM-DD", "reasonId": "string", "notes": "string?" }
Response: {
  "id": "string",
  "status": "Pending|Approved|Rejected|Conflicted",
  "startDateTime": "ISO8601",
  "endDateTime": "ISO8601",
  "reason": {...},
  "submittedAt": "ISO8601",
  "message": "string?"
}

POST /api/unavailability/create
Headers: Authorization: Bearer {token}
Body: {
  "startDateTime": "ISO8601",
  "endDateTime": "ISO8601",
  "reasonId": "string",
  "notes": "string?"
}
Response: { ... same as quick ... }
```

## 🧪 Testing Your Setup

### Test Login
1. Launch the app
2. Enter a valid User ID and Password
3. Tap "LOG IN"
4. You should see the schedule screen

### Test Face ID/Touch ID
1. After first login, the app will prompt for biometric setup
2. Accept the prompt
3. Lock your iPhone
4. Reopen the app
5. Face ID/Touch ID should prompt automatically

### Test Schedule View
1. View today's schedule
2. Swipe left to see tomorrow (if published)
3. Swipe right to see yesterday
4. Pull down to refresh

### Test Unavailability
1. Tap "Unavailable" button
2. Select "Quick" tab
3. Choose a reason
4. Tap "SUBMIT UNAVAILABILITY"
5. Verify the confirmation message

## 🐛 Common Issues

### Issue: "Signing for DFPNeo requires a development team"
**Solution**: Select your Apple ID team in Signing & Capabilities

### Issue: "Could not launch DFPNeo"
**Solution**: Trust the developer profile on your iPhone (Settings → General → VPN & Device Management)

### Issue: "Failed to verify code signature"
**Solution**: Clean build folder (Product → Clean Build Folder) and rebuild

### Issue: Logo not showing
**Solution**: 
1. Verify image set is named exactly `dfp-neo-logo`
2. Check that Logo.png is in the 1x slot
3. Clean and rebuild

### Issue: "Cannot connect to server"
**Solution**:
1. Verify API endpoint URL in APIService.swift
2. Check that your iPhone can reach the server
3. Verify SSL certificate is valid
4. Check App Transport Security settings in Info.plist

## 📱 Device Requirements

- iPhone running iOS 16.0 or later
- Face ID or Touch ID enabled (optional but recommended)
- Internet connectivity
- Sufficient storage space (~50MB)

## 🎓 Next Steps

Once the app is running:

1. **Test all features** using the checklist in README.md
2. **Customize branding** (colors, fonts) if needed
3. **Add analytics** (optional) for usage tracking
4. **Prepare for App Store** when ready for wider distribution

## 📞 Need Help?

- Review the full README.md for detailed documentation
- Check API integration guide
- Contact DFP-NEO support team
- Review Xcode build logs for specific errors

## ✅ You're Ready!

If you've completed all steps above, your DFP-NEO iOS app is ready to use. Enjoy secure, mobile access to your flight schedule!