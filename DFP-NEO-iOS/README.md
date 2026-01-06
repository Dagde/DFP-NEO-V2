# DFP-NEO Mobile App (iOS)

Aviation-grade flight scheduling companion app for iPhone.

## 📱 Overview

DFP-NEO Mobile is a native iOS application that provides secure, read-focused access to the DFP-NEO flight scheduling system. The app allows users to view their daily schedules and report unavailability directly from their iPhone.

## ✨ Features

### Authentication & Security
- **User ID + Password Login**: Compatible with DFP-NEO authentication system
- **Face ID / Touch ID**: Biometric authentication for quick access
- **Secure Token Storage**: Keychain-based credential management
- **Auto-Lock**: Session locks after 3 minutes of inactivity
- **Background Lock**: Automatic lock when app goes to background

### Schedule Viewing
- **Daily Schedule Display**: View your personal DFP-NEO schedule
- **Swipe Navigation**: 
  - Swipe left: Next day (if published)
  - Swipe right: Previous day (up to 7 days back)
- **Pull-to-Refresh**: Update schedule data
- **Event Details**:
  - Start/End times
  - Event type (Flight, FTD, Brief, Duty, etc.)
  - Location and aircraft
  - Role (Student, Instructor, Crew)
  - Status (Published, Cancelled, Amended)
  - Notes and instructor information
- **Publication State**: Respects DFP-NEO publication rules
- **Offline Indicator**: Shows when data is cached

### Unavailability Reporting
- **Quick Unavailability**: One-touch report for today (0800-2300)
- **Custom Unavailability**: Specify exact start/end times
- **Reason Selection**: Choose from DFP-NEO reason list
- **Optional Notes**: Add context to submissions
- **Status Acknowledgement**: Clear feedback on submission status
  - Pending
  - Approved
  - Rejected
  - Conflicted

## 🛠 Technology Stack

- **Language**: Swift
- **UI Framework**: SwiftUI
- **Architecture**: MVVM (Model-View-ViewModel)
- **Networking**: async/await + URLSession
- **Security**: 
  - Keychain for token storage
  - LocalAuthentication for biometrics
- **Minimum iOS**: 16.0
- **Supported Devices**: iPhone (all modern sizes)
- **Orientations**: Portrait + Landscape

## 📋 Prerequisites

- macOS with Xcode 15.0 or later
- iOS 16.0+ device or simulator
- Apple Developer account (for device deployment)
- Access to DFP-NEO backend API

## 🚀 Installation & Setup

### 1. Open in Xcode

```bash
cd DFP-NEO-iOS
open DFPNeo.xcodeproj
```

### 2. Configure Bundle Identifier

1. Select the project in Xcode
2. Select the "DFPNeo" target
3. Go to "Signing & Capabilities"
4. Update the Bundle Identifier to match your organization:
   - Current: `com.dfpneo.mobile`
   - Change to: `com.YOUR_ORG.dfpneo.mobile`

### 3. Configure API Endpoint

Edit `DFPNeo/Services/APIService.swift`:

```swift
private let baseURL = "https://dfp-neo.com/api"
```

Update this to your DFP-NEO backend URL.

### 4. Add App Icon

1. Open `Assets.xcassets`
2. Select `AppIcon`
3. Drag and drop your app icons for each size
4. Recommended: Use the DFP-NEO logo

### 5. Add Launch Logo

1. Open `Assets.xcassets`
2. Create a new Image Set named "dfp-neo-logo"
3. Add the provided Logo.png file
4. Set rendering mode to "Original"

### 6. Configure Signing

1. Select your development team in "Signing & Capabilities"
2. Xcode will automatically manage provisioning profiles

### 7. Build and Run

- **Simulator**: Select an iPhone simulator and press Cmd+R
- **Device**: Connect your iPhone, select it, and press Cmd+R

## 📱 First-Time Device Installation

### For Personal Use (No App Store)

1. **Connect iPhone to Mac**
2. **Trust Computer**: Unlock iPhone and tap "Trust"
3. **Select Device in Xcode**: Choose your iPhone from device list
4. **Build and Run**: Press Cmd+R
5. **Trust Developer**:
   - On iPhone: Settings → General → VPN & Device Management
   - Tap your developer profile
   - Tap "Trust"
6. **Launch App**: App will now run on your device

### App Store Preparation (Future)

When ready for App Store distribution:

1. **Update Info.plist**:
   - Add privacy descriptions
   - Configure app capabilities
   
2. **Create App Store Connect Record**:
   - Log in to App Store Connect
   - Create new app
   - Fill in metadata
   
3. **Archive and Upload**:
   - Product → Archive in Xcode
   - Upload to App Store Connect
   - Submit for review

## 🔐 Security Configuration

### App Transport Security

The app is configured to only allow HTTPS connections. The `Info.plist` includes:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>dfp-neo.com</key>
        <dict>
            <key>NSIncludesSubdomains</key>
            <true/>
            <key>NSExceptionRequiresForwardSecrecy</key>
            <true/>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.2</string>
        </dict>
    </dict>
</dict>
```

Update the domain to match your backend.

### Biometric Authentication

Face ID usage is declared in `Info.plist`:

```xml
<key>NSFaceIDUsageDescription</key>
<string>DFP-NEO uses Face ID to securely authenticate your session</string>
```

## 🏗 Project Structure

```
DFPNeo/
├── DFPNeoApp.swift          # App entry point
├── ContentView.swift        # Main navigation controller
├── Models/
│   ├── User.swift           # User and auth models
│   ├── Schedule.swift       # Schedule and event models
│   └── Unavailability.swift # Unavailability models
├── Views/
│   ├── LoginView.swift      # Login screen
│   ├── ScheduleView.swift   # Schedule display
│   └── UnavailabilityView.swift # Unavailability form
├── ViewModels/
│   ├── AuthViewModel.swift  # Auth state management
│   ├── ScheduleViewModel.swift # Schedule logic
│   └── UnavailabilityViewModel.swift # Unavailability logic
├── Services/
│   ├── APIService.swift     # HTTP client
│   ├── AuthService.swift    # Authentication
│   ├── KeychainService.swift # Secure storage
│   └── BiometricService.swift # Face ID/Touch ID
├── Assets.xcassets          # Images and colors
└── Info.plist              # App configuration
```

## 🔌 API Integration

The app expects the following DFP-NEO API endpoints:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Schedule
- `GET /api/schedule?date=YYYY-MM-DD` - Get daily schedule

### Unavailability
- `GET /api/unavailability/reasons` - Get reason list
- `POST /api/unavailability/quick` - Quick unavailability
- `POST /api/unavailability/create` - Custom unavailability

## 🎨 Design Guidelines

### Color Scheme
- **Background**: Black (`Color.black`)
- **Text**: White with varying opacity
- **Accents**: System colors (blue, green, red, orange)
- **Cards**: White with 10% opacity

### Typography
- **Headlines**: Bold, tracking +2
- **Body**: Regular weight
- **Captions**: Uppercase, tracking +2

### Spacing
- **Card padding**: 16pt
- **Section spacing**: 20pt
- **Element spacing**: 12pt

## 🧪 Testing

### Manual Testing Checklist

- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Face ID/Touch ID enrollment
- [ ] Face ID/Touch ID unlock
- [ ] View today's schedule
- [ ] Swipe to next day
- [ ] Swipe to previous day
- [ ] Pull to refresh
- [ ] View unpublished day
- [ ] Submit quick unavailability
- [ ] Submit custom unavailability
- [ ] Session auto-lock (3 minutes)
- [ ] Background lock
- [ ] Logout
- [ ] Offline mode
- [ ] Portrait orientation
- [ ] Landscape orientation

## 🐛 Troubleshooting

### Build Errors

**"No signing certificate found"**
- Solution: Select your development team in Signing & Capabilities

**"Failed to verify bitcode"**
- Solution: Disable bitcode in Build Settings

### Runtime Issues

**"Cannot connect to server"**
- Check API endpoint URL in `APIService.swift`
- Verify network connectivity
- Check App Transport Security settings

**"Face ID not working"**
- Ensure Face ID is enrolled on device
- Check Info.plist has Face ID usage description
- Verify biometric permissions

**"Session keeps locking"**
- Check session timeout setting (default 3 minutes)
- Verify token refresh is working
- Check keychain access

## 📝 Development Notes

### Adding New Features

1. **Models**: Add data structures in `Models/`
2. **Services**: Add API calls in `Services/`
3. **ViewModels**: Add business logic in `ViewModels/`
4. **Views**: Add UI in `Views/`

### Code Style

- Use SwiftUI for all UI
- Follow MVVM architecture
- Use async/await for networking
- Store sensitive data in Keychain
- Use @Published for observable state
- Use @MainActor for UI updates

## 📄 License

Proprietary - DFP-NEO Platform

## 🤝 Support

For issues or questions:
- Check DFP-NEO documentation
- Contact DFP-NEO support team
- Review API integration guide

## 🔄 Version History

### Version 1.0 (Current)
- Initial release
- User authentication with Face ID/Touch ID
- Daily schedule viewing
- Unavailability reporting
- Swipe navigation
- Offline support
- Session management

## 🎯 Success Criteria

The app is considered complete when:
- ✅ Users can log in using DFP-NEO credentials
- ✅ Face ID / Touch ID works reliably
- ✅ Daily schedules match the DFP-NEO browser app exactly
- ✅ Unavailability entries appear immediately in DFP-NEO
- ✅ All backend acknowledgements are visible to the user
- ✅ App behaves identically across iPhone sizes and orientations

## 🚫 Explicit Non-Goals

- ❌ No schedule editing
- ❌ No admin/supervisor views
- ❌ No trainee/instructor swapping
- ❌ No DFP construction or publishing
- ❌ No embedded web browser
- ❌ No Android version (Phase 1)