# Step-by-Step Xcode Setup Guide

## Getting Started with Your DFP-NEO App

### Step 1: Verify Your Project is Created
1. In Xcode, look at the left sidebar (called "Navigator")
2. You should see your project name "DFP-NEO App" at the top
3. Click the triangle next to it to expand - you should see folders

### Step 2: Add the Main App File
1. In the Navigator sidebar, click on the "App" folder
2. Look for a file with ".swift" extension (might have default name)
3. Click on it to select it
4. Press the "Delete" key and click "Move to Trash"
5. Right-click on the "App" folder and select "New File..."
6. Choose "Swift File" and click Next
7. Name it "DFPNeoApp.swift" and click Create

### Step 3: Replace the Content
Copy the main app code into DFPNeoApp.swift

### Step 4: Create Folder Structure
Create these folders by right-clicking the project and selecting "New Group":
- Models
- Views  
- ViewModels
- Services

### Step 5: Add Model Files
1. Create "User.swift" in Models folder
2. Create "Schedule.swift" in Models folder  
3. Create "Unavailability.swift" in Models folder

### Step 6: Add View Files
1. Create "LoginView.swift" in Views folder
2. Create "ScheduleView.swift" in Views folder
3. Create "UnavailabilityView.swift" in Views folder
4. Create "ContentView.swift" in main folder

### Step 7: Add ViewModel Files
1. Create "AuthViewModel.swift" in ViewModels folder
2. Create "ScheduleViewModel.swift" in ViewModels folder
3. Create "UnavailabilityViewModel.swift" in ViewModels folder

### Step 8: Add Service Files
1. Create "APIService.swift" in Services folder
2. Create "AuthService.swift" in Services folder
3. Create "KeychainService.swift" in Services folder
4. Create "BiometricService.swift" in Services folder

### Step 9: Configure Project Settings
1. Click the project name at top of Navigator
2. Set Bundle Identifier
3. Add Face ID permission
4. Configure App Transport Security

### Step 10: Build and Test
Run the app on your device