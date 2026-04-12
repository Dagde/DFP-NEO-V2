with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find initializeData start
pos = content.find(b'initializeData = async')
print(f'initializeData starts at: {pos}')

# Get a very large chunk and look for its end
chunk = content[pos:pos+15000]

# Find the return statement - try different patterns
for pattern in [b'return {', b'return{', b'return \n', b'return (\n', b'  return']:
    rp = chunk.find(pattern)
    if rp != -1:
        print(f'Pattern {repr(pattern)} at chunk offset {rp}:')
        print(repr(chunk[rp:rp+300]))
        print()

# Print the LAST 500 bytes of what we think is initializeData (look for closing })
# Find where initializeData ends by looking for the next function definition
next_func = chunk.find(b'\nasync function ')
if next_func == -1:
    next_func = chunk.find(b'\nconst ')
print(f'initializeData ends around chunk offset {next_func}')
print('End of initializeData:')
print(repr(chunk[max(0,next_func-500):next_func+100]))