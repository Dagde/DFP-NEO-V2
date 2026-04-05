data = open('index.js', 'rb').read()
original_size = len(data)

# Fix: Also migrate Tailwind classes in the API DB colors loading path
old = b'data.courses.forEach((c) => { dbColors[c.name] = (c.color === "#F97316" || c.color === "#f97316") ? "#D4722A" : (c.color || "#6366f1"); });'

new = b'''data.courses.forEach((c) => {
            const twToHex2 = {
              "bg-sky-400/50": "#7DD3FC", "bg-purple-400/50": "#C084FC",
              "bg-yellow-400/50": "#FACC15", "bg-pink-400/50": "#F472B6",
              "bg-teal-400/50": "#2DD4BF", "bg-indigo-400/50": "#818CF8",
              "bg-cyan-400/50": "#22D3EE", "bg-blue-400/50": "#60A5FA",
              "bg-green-400/50": "#4ADE80", "bg-orange-400/50": "#FB923C",
              "bg-red-400/50": "#F87171", "bg-gray-400/50": "#9CA3AF"
            };
            const rawColor = (c.color === "#F97316" || c.color === "#f97316") ? "#D4722A" : (c.color || "#6366f1");
            dbColors[c.name] = twToHex2[rawColor] || rawColor;
          });'''

count = data.count(old)
print(f'Pattern found: {count} times')

if count == 1:
    data = data.replace(old, new, 1)
    print('Patch applied successfully')
    print(f'Original size: {original_size}, New size: {len(data)}')
    open('index.js', 'wb').write(data)
    print('File written')
else:
    print('ERROR: Pattern not found exactly once!')
    partial = b'data.courses.forEach((c) => { dbColors'
    idx = data.find(partial)
    print(f'Partial match at {idx}: {repr(data[idx:idx+150])}')