#!/usr/bin/env python3
import re

# Read the file
with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the exact response block using simpler pattern
old_pattern = r'res\.json\(\s*\n\s*accessToken,'
    
new_code = '''res.json({
           success: true,
           message: "Login successful",
           data: {
             accessToken,'''

if old_pattern in content:
    print("Found the pattern!")
else:
    print("Pattern not found, trying alternative approach")
    # Look for the specific line
    if 'accessToken,' in content:
        # Find the index
        idx = content.find('accessToken,')
        print(f"Found 'accessToken,' at index {idx}")
        print("Context around it:")
        start = max(0, idx - 200)
        end = min(len(content), idx + 200)
        print(repr(content[start:end]))