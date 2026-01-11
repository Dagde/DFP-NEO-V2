#!/usr/bin/env python3

with open('App.tsx', 'r') as f:
    content = f.read()

# Remove the if (onShowSuccess) wrappers
content = content.replace(
    "if (onShowSuccess) {\n                       setSuccessMessage(`Navigated to Staff Profile: ${user.name}`);\n                   }",
    "setSuccessMessage(`Navigated to Staff Profile: ${user.name}`);"
)

content = content.replace(
    "if (onShowSuccess) {\n                       setSuccessMessage(`Staff profile not found: ${user.name}`);\n                   }",
    "setSuccessMessage(`Staff profile not found: ${user.name}`);"
)

content = content.replace(
    "if (onShowSuccess) {\n                       setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);\n                   }",
    "setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);"
)

content = content.replace(
    "if (onShowSuccess) {\n                       setSuccessMessage(`Trainee profile not found: ${user.name}`);\n                   }",
    "setSuccessMessage(`Trainee profile not found: ${user.name}`);"
)

with open('App.tsx', 'w') as f:
    f.write(content)

print("✅ Removed if (onShowSuccess) wrappers")