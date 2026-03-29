with open('DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the updated LMP sync block
start = content.find('// --- Individual LMP Sync ---')
end = content.find('// Initialize Individual LMPs for all DB trainees', start)
print(content[start:end])