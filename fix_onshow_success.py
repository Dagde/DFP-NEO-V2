#!/usr/bin/env python3

with open('App.tsx', 'r') as f:
    content = f.read()

# Simple replacements
content = content.replace('onShowSuccess(`Navigated to Staff Profile:', 'setSuccessMessage(`Navigated to Staff Profile:')
content = content.replace('onShowSuccess(`Staff profile not found:', 'setSuccessMessage(`Staff profile not found:')
content = content.replace('onShowSuccess(`Navigated to Trainee Profile:', 'setSuccessMessage(`Navigated to Trainee Profile:')
content = content.replace('onShowSuccess(`Trainee profile not found:', 'setSuccessMessage(`Trainee profile not found:')

with open('App.tsx', 'w') as f:
    f.write(content)

print("✅ Fixed onShowSuccess calls")