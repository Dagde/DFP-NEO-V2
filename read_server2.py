with open('DFP-NEO-V2-fresh/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the POST lmp-sync handler in full
start = content.find("for (const trainee of trainees) {")
end = content.find("res.json({\n      success: true,", start) + 300
print(content[start:end])