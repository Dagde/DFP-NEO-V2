#!/usr/bin/env python3
import re

with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'r') as f:
    content = f.read()

# Find and replace the data grid section
old_pattern = r'(/\* Row 1 \*/\s*<div><span className="text-gray-400 block text-\[10px\]">ID Number</span>.*?</div>\s*<div></div>\s*/\* Row 2 \*/\s*<div><span className="text-gray-400 block text-\[10px\]">Rank</span>.*?</div>\s*<div><span className="text-gray-400 block text-\[10px\]">Flight</span>.*?</div>\s*/\* Row 3 \*/\s*<div className="col-span-3"><span className="text-gray-400 block text-\[10px\]">Phone Number</span>.*?</div>\s*<div className="col-span-4"><span className="text-gray-400 block text-\[10px\]">Email</span>.*?</div>)'

new_content = r'''/* Row 1 */}
                              <div><span className="text-gray-400 block text-[10px]">ID Number</span><span className="text-white font-medium">{trainee.idNumber}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Course</span><span className={`font-semibold px-1 rounded text-white text-[10px] ${courseColors[trainee.course] || 'bg-gray-500'}`}>{trainee.course}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">LMP</span><span className="text-sky-300 font-medium">{trainee.lmpType || 'BPC+IPC'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Callsign</span><span className="text-white font-medium">{trainee.traineeCallsign || `${callsignData?.callsignPrefix || ''}${callsignData?.callsignNumber || ''}`}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Secondary Callsign</span><span className="text-gray-300">[None]</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Seat Config</span><span className="text-white font-medium">{trainee.seatConfig}</span></div>
                              {/* Row 2 */}
                              <div><span className="text-gray-400 block text-[10px]">Rank</span><span className="text-white font-medium">{trainee.rank}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Service</span><span className="text-white font-medium">{trainee.service || 'RAAF'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Unit</span><span className="text-white font-medium">{trainee.unit}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Crew</span><span className="text-white font-medium">{trainee.crew || 'N/A'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Location</span><span className="text-white font-medium">{trainee.location}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Flight</span><span className="text-white font-medium">{trainee.flight || 'N/A'}</span></div>
                              {/* Row 3 */}
                              <div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{trainee.phoneNumber || 'N/A'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{trainee.email || 'N/A'}</span></div>
                              <div></div>
                              <div></div>
                              <div></div>
                              <div></div>'''

content = re.sub(old_pattern, new_content, content, flags=re.DOTALL)

# Increase instructor thumbnail size from w-7 h-7 to w-9 h-9
content = re.sub(r'w-7 h-7 bg-gray-600 rounded-full', r'w-9 h-9 bg-gray-600 rounded-full', content)
content = re.sub(r'w-7 h-7 bg-gray-700/50 rounded-full', r'w-9 h-9 bg-gray-700/50 rounded-full', content)

with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'w') as f:
    f.write(content)

print("Updated TraineeProfileFlyout.tsx")