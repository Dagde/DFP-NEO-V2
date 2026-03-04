#!/usr/bin/env python3
import re

# Read the file
with open('dfp-neo-platform/public/flight-school-app/index.html', 'r') as f:
    content = f.read()

# 1. Update .btn-aluminium-brushed.active to use #a0a0a0 background
# Find the .btn-aluminium-brushed.active block and replace it
old_active = r'  \.btn-aluminium-brushed\.active, \.btn-aluminium-brushed:active \{\s*background-image: linear-gradient\(to right, #9ca3af, #d1d5db, #9ca3af\);\s*box-shadow: inset 0 1px 2px rgba\(0,0,0,0\.2\);\s*border-top-color: #9ca3af;\s*border-bottom-color: #d1d5db;\s*border-left-color: #9ca3af;\s*border-right-color: #9ca3af;\s*transform: none;'

new_active = '''  .btn-aluminium-brushed.active, .btn-aluminium-brushed:active {
    background-color: #a0a0a0;
    background-image: none;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
    border-top-color: #909090;
    border-bottom-color: #b0b0b0;
    border-left-color: #909090;
    border-right-color: #909090;
    transform: none;'''

content = re.sub(old_active, new_active, content, flags=re.DOTALL)

# 2. Add NEO-Tile pulsing animation CSS
# Find a good place to insert it - after the no-select class
neo_animation_css = '''  @keyframes pulse-neo-text {
    0%, 100% { color: #fb923c; text-shadow: 0 0 4px rgba(251, 146, 60, 0.6); }
    50% { color: #fdba74; text-shadow: 0 0 8px rgba(251, 146, 60, 1); }
  }
  .animate-pulse-neo-text { animation: pulse-neo-text 1s ease-in-out infinite; }
  .neo-tile-text { color: #fb923c; }'''

# Insert after .no-select class
no_select_pattern = r'(\.no-select \{[^\}]+\})'
content = re.sub(no_select_pattern, r'\1\n' + neo_animation_css, content)

# Write the file back
with open('dfp-neo-platform/public/flight-school-app/index.html', 'w') as f:
    f.write(content)

print("✅ Updated index.html successfully!")

# Now update index-v2.html the same way
with open('dfp-neo-platform/public/flight-school-app/index-v2.html', 'r') as f:
    content = f.read()

content = re.sub(old_active, new_active, content, flags=re.DOTALL)
content = re.sub(no_select_pattern, r'\1\n' + neo_animation_css, content)

with open('dfp-neo-platform/public/flight-school-app/index-v2.html', 'w') as f:
    f.write(content)

print("✅ Updated index-v2.html successfully!")
print("✅ All CSS updates complete!")