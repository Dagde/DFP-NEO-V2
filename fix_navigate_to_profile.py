#!/usr/bin/env python3

with open('App.tsx', 'r') as f:
    content = f.read()

# Replace all occurrences of onShowSuccess with setSuccessMessage in handleNavigateToProfile functions
content = content.replace(
    "if (onShowSuccess) {\n                       onShowSuccess(`Navigated to Staff Profile: ${user.name}`);\n                   }",
    "setSuccessMessage(`Navigated to Staff Profile: ${user.name}`);"
)

content = content.replace(
    "if (onShowSuccess) {\n                       onShowSuccess(`Staff profile not found: ${user.name}`);\n                   }",
    "setSuccessMessage(`Staff profile not found: ${user.name}`);"
)

content = content.replace(
    "if (onShowSuccess) {\n                       onShowSuccess(`Navigated to Trainee Profile: ${user.name}`);\n                   }",
    "setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);"
)

content = content.replace(
    "if (onShowSuccess) {\n                       onShowSuccess(`Trainee profile not found: ${user.name}`);\n                   }",
    "setSuccessMessage(`Trainee profile not found: ${user.name}`);"
)

with open('App.tsx', 'w') as f:
    f.write(content)

print("✅ Fixed handleNavigateToProfile to use setSuccessMessage")