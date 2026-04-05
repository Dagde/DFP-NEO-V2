data = open('index.js', 'rb').read()
original_size = len(data)

# Change ADF303 color from #FACC15 (yellow) to olive green
# Using #808000 - classic olive, visible on dark backgrounds
# Or #6B8E23 - olive drab (more military/olive look)
# Going with #6B8E23 - olive drab green

patches = [
    # eslCourses definition
    (b'{ name: "ADF303", color: "#FACC15"         ', b'{ name: "ADF303", color: "#6B8E23"         '),
    # Tailwind-to-hex migration maps (both twToHex and twToHex2)
    (b'"bg-yellow-400/50": "#FACC15"', b'"bg-yellow-400/50": "#6B8E23"'),
    # convertTailwindToHex colorMap
    (b'"bg-yellow-400/50": "#FACC15",', b'"bg-yellow-400/50": "#6B8E23",'),
]

for old, new, in patches:
    count = data.count(old)
    print(f'Pattern "{old[:40]}": found {count} times')
    if count > 0:
        data = data.replace(old, new)
        print(f'  Applied')
    else:
        print(f'  WARNING: not found')

print(f'Original size: {original_size}, New size: {len(data)}')
open('index.js', 'wb').write(data)
print('File written')