import re

with open('App.tsx', 'r') as f:
    content = f.read()

# Fix Instance 1 (around line 13851) - remove duplicate closing brace
content = re.sub(
    r'(setInstructorsData\(prev => \{[^}]+\}\);\s*\n\s*\}\);)\s*\n\s*\}\}\)', 
    r'\1\n                            }}',
    content,
    count=1
)

# Fix Instance 2 (around line 13966) - remove duplicate code
# Remove the duplicate "const dbId = (data as any).id;" and "try {" after the logging
pattern2 = r"(console\.log\('📝 \[APP\] Instructor DB ID:', dbId\);\s*\n\s*try \{)(\s+const dbId = \(data as any\)\.id;\s*\n\s*try \{)"

replacement2 = r"\1 try {"

content = re.sub(pattern2, replacement2, content, count=1)

with open('App.tsx', 'w') as f:
    f.write(content)

print("Fixed syntax errors")