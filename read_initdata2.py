with open('DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the initializeData function definition
idx = content.find('const initializeData')
if idx == -1:
    idx = content.find('async function initializeData')
if idx == -1:
    idx = content.find('initializeData = async')
    
print(f"Found at: {idx}")
print(content[max(0, idx-100):idx+3000])