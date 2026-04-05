data = open('index.js', 'rb').read()
original_size = len(data)

# Fix 1: Normalize event.color at tile render time - replace old yellow with olive green
# Add a color normalization step right before backgroundClass is computed

old_bg = b'const backgroundClass = event.type === "deployment" ? "bg-gray-600/30 border border-white/60" : event.type === "unavailability" ? "bg-red-900/80 border border-red-600/60" : isUnavailabilityConflict ? "bg-red-800/90" : isConflicting ? "bg-red-600/70" : (event.color && event.color.startsWith("#") ? "" : event.color);'

new_bg = b'''const LEGACY_COLOR_MAP = { "#FACC15": "#6B8E23", "#38BDF8": "#7DD3FC" };
  const tileColor = event.color && LEGACY_COLOR_MAP[event.color] ? LEGACY_COLOR_MAP[event.color] : event.color;
  const backgroundClass = event.type === "deployment" ? "bg-gray-600/30 border border-white/60" : event.type === "unavailability" ? "bg-red-900/80 border border-red-600/60" : isUnavailabilityConflict ? "bg-red-800/90" : isConflicting ? "bg-red-600/70" : (tileColor && tileColor.startsWith("#") ? "" : tileColor);'''

# Fix 2: Also update the style assignment to use tileColor instead of event.color
old_style = b'style: event.color && event.color.startsWith("#") ? Object.assign({}, style, { backgroundColor: event.color }) : style,'
new_style = b'style: tileColor && tileColor.startsWith("#") ? Object.assign({}, style, { backgroundColor: tileColor }) : style,'

count1 = data.count(old_bg)
count2 = data.count(old_style)
print(f'backgroundClass pattern: {count1}')
print(f'style pattern: {count2}')

if count1 == 1 and count2 == 1:
    data = data.replace(old_bg, new_bg, 1)
    data = data.replace(old_style, new_style, 1)
    print('Both patches applied')
    print(f'Original: {original_size}, New: {len(data)}')
    open('index.js', 'wb').write(data)
    print('File written')
else:
    print('ERROR: patterns not found')
    if count1 == 0:
        partial = b'const backgroundClass = event.type'
        idx = data.find(partial)
        print(f'backgroundClass partial at {idx}: {repr(data[idx:idx+100])}')
    if count2 == 0:
        partial = b'style: event.color && event.color.startsWith'
        idx = data.find(partial)
        print(f'style partial at {idx}: {repr(data[idx:idx+100])}')