with open('DFP-NEO-V2-fresh/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the scores route / how scores are fetched
idx = content.find('/api/scores')
count = 0
while idx != -1 and count < 5:
    print(f"\n{'='*60}")
    print(f"Found '/api/scores' at position {idx}")
    print('='*60)
    print(content[max(0, idx-100):idx+800])
    idx = content.find('/api/scores', idx+1)
    count += 1

# Also look for Score model query
idx = content.find('score.findMany')
if idx != -1:
    print(f"\n{'='*60}")
    print(f"Found 'score.findMany' at position {idx}")
    print('='*60)
    print(content[max(0, idx-200):idx+800])