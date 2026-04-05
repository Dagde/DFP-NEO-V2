import sys

data = open('index.js', 'rb').read()
original_size = len(data)

# The file uses plain " (0x22) characters, NOT escaped \" 
# Python byte string b'something "quoted" text'

# ============================================================
# FIX 1: Replace currentScheduleForDate with publishedSchedules[date] || []
# Fix 1a was already applied. Need to fix 1b and 1c.
# Let's check exact bytes at the remaining 2 occurrences
# ============================================================

# Check remaining occurrences
idx_b = data.find(b'currentScheduleForDate')
while idx_b != -1:
    print(f'Pos {idx_b}: {repr(data[idx_b:idx_b+120])}')
    idx_b = data.find(b'currentScheduleForDate', idx_b+1)

print()

# ============================================================
# FIX 2: Check exact bytes for eslCourses colors
# ============================================================

idx_adf301 = data.find(b'name: "ADF301"')
print(f'ADF301 at {idx_adf301}: {repr(data[idx_adf301-5:idx_adf301+80])}')

idx_adf303 = data.find(b'name: "ADF303"')
print(f'ADF303 at {idx_adf303}: {repr(data[idx_adf303-5:idx_adf303+80])}')