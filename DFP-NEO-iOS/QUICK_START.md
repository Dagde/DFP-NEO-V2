# 🚀 DFP-NEO iOS - Quick Start Guide

Get your DFP-NEO mobile app running in 5 minutes!

## 📋 What You Need

- Mac with Xcode 15.0+
- iPhone running iOS 16.0+
- USB cable
- Apple ID (free)

## ⚡ 5-Minute Setup

### 1️⃣ Open Project (30 seconds)
```bash
cd DFP-NEO-iOS
open DFPNeo.xcodeproj
```

### 2️⃣ Configure Bundle ID (1 minute)
1. Click "DFPNeo" in left sidebar
2. Select "DFPNeo" target
3. Go to "Signing & Capabilities"
4. Change Bundle Identifier: `com.YOUR_ORG.dfpneo.mobile`
5. Select your Team

### 3️⃣ Add Logo (1 minute)
1. Open `Assets.xcassets` in Xcode
2. Right-click → "New Image Set"
3. Name it: `dfp-neo-logo`
4. Drag `Logo.png` into 1x slot
5. Set "Render As" to "Original Image"

### 4️⃣ Set API URL (30 seconds)
1. Open `DFPNeo/Services/APIService.swift`
2. Line 14: Change to your backend URL
```swift
private let baseURL = "https://YOUR_DOMAIN/api"
```

### 5️⃣ Run on iPhone (2 minutes)
1. Connect iPhone to Mac
2. Unlock iPhone → Trust Computer
3. Select iPhone in Xcode (top left)
4. Click Play ▶️ or press `Cmd+R`
5. On iPhone: Settings → General → VPN & Device Management
6. Tap your profile → Trust
7. Launch DFP-NEO app!

## ✅ You're Done!

Your app is now running on your iPhone. Test it:
- Log in with your DFP-NEO credentials
- Enable Face ID/Touch ID
- View your schedule
- Report unavailability

## 📚 Need More Help?

- **Full Setup**: See `SETUP_GUIDE.md`
- **API Details**: See `API_INTEGRATION.md`
- **Deployment**: See `DEPLOYMENT_CHECKLIST.md`
- **Everything**: See `README.md`

## 🐛 Quick Fixes

**Can't build?**
- Product → Clean Build Folder
- Restart Xcode

**Can't install on device?**
- Check USB cable
- Trust computer on iPhone
- Select correct device in Xcode

**App crashes?**
- Check API URL is correct
- Verify backend is running
- Check Xcode console for errors

## 🎉 Success!

You now have DFP-NEO running on your iPhone. Enjoy secure, mobile access to your flight schedule!

---

**Next Steps**: Test all features, customize branding, prepare for App Store (optional)