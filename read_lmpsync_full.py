with open('DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the full LMP sync block in loadInitialData
start = content.find('// --- Individual LMP Sync ---')
end = content.find('} catch (error)', start+100)
# find the matching } catch after the try block
print(content[start:end+200])