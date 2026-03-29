with open('DFP-NEO-V2-fresh/lib/dataService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find initializeData
idx = content.find('export async function initializeData')
print(content[idx:idx+4000])