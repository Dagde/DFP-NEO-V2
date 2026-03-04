#!/usr/bin/env python3
import re

def update_instructor_profile(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Update Row 1: Move Seat Config to position 6 (after Secondary Callsign)
    # Current: ID Number, Role, Category, Callsign, Secondary Callsign, [empty]
    # New: ID Number, Role, Category, Callsign, Secondary Callsign, Seat Config
    row1_pattern = r'(/\* Row 1 \*/.*?<div><span className="text-gray-400 block text-\[10px\]">Secondary Callsign</span>.*?</div>\s*<div></div>)'
    row1_replacement = r'''/* Row 1 */
                        <div><span className="text-gray-400 block text-[10px]">ID Number</span><span className="text-white font-medium">{instructor.idNumber}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Role</span><span className="text-sky-300 font-medium">{instructor.role}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Category</span><span className="text-white font-medium">{instructor.category}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Callsign</span><span className="text-white font-medium">{callsignData?.callsignPrefix || ''}{instructor.callsignNumber || ''}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Secondary Callsign</span><span className="text-gray-300">[None]</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Seat Config</span><span className="text-white font-medium">{instructor.seatConfig}</span></div>'''
    
    content = re.sub(row1_pattern, row1_replacement, content, flags=re.DOTALL)
    
    # Update Row 2: Add Crew, reorder to Unit, Crew, Location, Flight
    # Current: Rank, Service, Unit, Seat Config, Location, Flight
    # New: Rank, Service, Unit, Crew, Location, Flight
    row2_pattern = r'(/\* Row 2 \*/.*?<div><span className="text-gray-400 block text-\[10px\]">Unit</span>.*?</div>\s*<div><span className="text-gray-400 block text-\[10px\]">Seat Config</span>.*?</div>\s*<div><span className="text-gray-400 block text-\[10px\]">Location</span>.*?</div>\s*<div><span className="text-gray-400 block text-\[10px\]">Flight</span>.*?</div>)'
    row2_replacement = r'''/* Row 2 */
                        <div><span className="text-gray-400 block text-[10px]">Rank</span><span className="text-white font-medium">{instructor.rank}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Service</span><span className="text-white font-medium">{instructor.service || 'RAAF'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Unit</span><span className="text-white font-medium">{instructor.unit}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Crew</span><span className="text-white font-medium">{instructor.crew || 'N/A'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Location</span><span className="text-white font-medium">{instructor.location}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Flight</span><span className="text-white font-medium">{instructor.flight || 'N/A'}</span></div>'''
    
    content = re.sub(row2_pattern, row2_replacement, content, flags=re.DOTALL)
    
    # Update Row 3: Phone Number and Email side by side (no col-span)
    row3_pattern = r'(/\* Row 3 \*/\s*<div className="col-span-3"><span className="text-gray-400 block text-\[10px\]">Phone Number</span>.*?</div>\s*<div className="col-span-4"><span className="text-gray-400 block text-\[10px\]">Email</span>.*?</div>)'
    row3_replacement = r'''/* Row 3 */
                        <div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{instructor.phoneNumber || 'N/A'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{instructor.email || 'N/A'}</span></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div></div>'''
    
    content = re.sub(row3_pattern, row3_replacement, content, flags=re.DOTALL)
    
    # Increase trainee thumbnail size from w-7 h-7 to w-9 h-9
    content = re.sub(r'w-7 h-7 bg-gray-600 rounded-full', r'w-9 h-9 bg-gray-600 rounded-full', content)
    content = re.sub(r'w-7 h-7 bg-gray-700/50 rounded-full', r'w-9 h-9 bg-gray-700/50 rounded-full', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Updated {filepath}")

def update_trainee_profile(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Update Row 1: Move Seat Config to position 6 (after Secondary Callsign)
    row1_pattern = r'(/\* Row 1 \*/.*?<div><span className="text-gray-400 block text-\[10px\]">Secondary Callsign</span>.*?</div>\s*<div></div>)'
    row1_replacement = r'''/* Row 1 */
                              <div><span className="text-gray-400 block text-[10px]">ID Number</span><span className="text-white font-medium">{trainee.idNumber}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Course</span><span className={`font-semibold px-1 rounded text-white text-[10px] ${courseColors[trainee.course] || 'bg-gray-500'}`}>{trainee.course}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">LMP</span><span className="text-sky-300 font-medium">{trainee.lmpType || 'BPC+IPC'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Callsign</span><span className="text-white font-medium">{trainee.traineeCallsign || `${callsignData?.callsignPrefix || ''}${callsignData?.callsignNumber || ''}`}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Secondary Callsign</span><span className="text-gray-300">[None]</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Seat Config</span><span className="text-white font-medium">{trainee.seatConfig}</span></div>'''
    
    content = re.sub(row1_pattern, row1_replacement, content, flags=re.DOTALL)
    
    # Update Row 2: Add Crew, reorder to Unit, Crew, Location, Flight
    row2_pattern = r'(/\* Row 2 \*/.*?<div><span className="text-gray-400 block text-\[10px\]">Unit</span>.*?</div>\s*<div><span className="text-gray-400 block text-\[10px\]">Seat Config</span>.*?</div>\s*<div><span className="text-gray-400 block text-\[10px\]">Location</span>.*?</div>\s*<div><span className="text-gray-400 block text-\[10px\]">Flight</span>.*?</div>)'
    row2_replacement = r'''/* Row 2 */
                              <div><span className="text-gray-400 block text-[10px]">Rank</span><span className="text-white font-medium">{trainee.rank}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Service</span><span className="text-white font-medium">{trainee.service || 'RAAF'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Unit</span><span className="text-white font-medium">{trainee.unit}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Crew</span><span className="text-white font-medium">{trainee.crew || 'N/A'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Location</span><span className="text-white font-medium">{trainee.location}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Flight</span><span className="text-white font-medium">{trainee.flight || 'N/A'}</span></div>'''
    
    content = re.sub(row2_pattern, row2_replacement, content, flags=re.DOTALL)
    
    # Update Row 3: Phone Number and Email side by side (no col-span)
    row3_pattern = r'(/\* Row 3 \*/\s*<div className="col-span-3"><span className="text-gray-400 block text-\[10px\]">Phone Number</span>.*?</div>\s*<div className="col-span-4"><span className="text-gray-400 block text-\[10px\]">Email</span>.*?</div>)'
    row3_replacement = r'''/* Row 3 */
                              <div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{trainee.phoneNumber || 'N/A'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{trainee.email || 'N/A'}</span></div>
                              <div></div>
                              <div></div>
                              <div></div>
                              <div></div>'''
    
    content = re.sub(row3_pattern, row3_replacement, content, flags=re.DOTALL)
    
    # Increase instructor thumbnail size from w-7 h-7 to w-9 h-9
    content = re.sub(r'w-7 h-7 bg-gray-600 rounded-full', r'w-9 h-9 bg-gray-600 rounded-full', content)
    content = re.sub(r'w-7 h-7 bg-gray-700/50 rounded-full', r'w-9 h-9 bg-gray-700/50 rounded-full', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Updated {filepath}")

# Update both files
update_instructor_profile('/workspace/DFP-NEO-V2-fresh/components/InstructorProfileFlyout.tsx')
update_trainee_profile('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx')

print("Done!")