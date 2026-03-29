import os
import shutil
src = "Screenshot 2026-03-28 at 9.40.14\u202fam.jpg"
dst = "screenshot_2026_03_28.jpg"
shutil.copy(src, dst)
print(f"Copied to {dst}")