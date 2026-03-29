with open('DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the block that contains syllabusData and surrounding context - go back further
idx = content.find('Build syllabusData payload')
print(content[max(0, idx-2000):idx+3000])