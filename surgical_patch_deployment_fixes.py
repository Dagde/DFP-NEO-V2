#!/usr/bin/env python3
"""
Surgical patches for deployment fixes:
1. Tile text on one line (DEPLOYMENT + deployed -> single line)
2. Default 0800 times used in save even if user doesn't change them
3. Add "Deployed" to unavailability reasons list
4. When flight dragged to Deployed row: add unavailability to staff/trainee
"""

BUNDLE_PATH = 'DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js'

with open(BUNDLE_PATH, 'rb') as f:
    content = f.read()

original_size = len(content)
print(f"Bundle size: {original_size:,} bytes")

changes = 0

def patch(old_str, new_str, label):
    global content, changes
    old = old_str.encode('utf-8')
    new = new_str.encode('utf-8')
    count = content.count(old)
    if count == 1:
        content = content.replace(old, new)
        changes += 1
        print(f"✅ {label}")
        return True
    elif count == 0:
        print(f"❌ {label} - NOT FOUND")
        partial = old[:50]
        idx = content.find(partial)
        if idx >= 0:
            print(f"   Partial at {idx}: {content[idx:idx+80]}")
        return False
    else:
        print(f"⚠️  {label} - FOUND {count} times (skipping)")
        return False

# ============================================================================
# PATCH 1: Fix deployment tile - show all on ONE line
# Current: "DEPLOYMENT" on one line, "deployed" on second line, times on third
# New: Single line "DEPLOYMENT | deployed" with times below (or combine)
# From bundle inspection the structure is:
#   div.overflow-hidden.text-center > [
#     div.text-white/80 "DEPLOYMENT"
#     div.font-mono.text-white/60 "deployed"
#     div.text-xs.text-white/50 [startTime, " - ", endTime]
#   ]
# Fix: remove the "deployed" div and put everything on one line
# ============================================================================
patch(
    'jsxDevRuntimeExports.jsxDEV("div", { className: "overflow-hidden text-center", children: [\n        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-white/80 font-medium text-sm", children: "DEPLOYMENT" }, void 0, false, {\n          fileName: "/workspace/DFP-NEO-V2-fresh/components/FlightTile.tsx",\n          lineNumber: 403,\n          columnNumber: 21\n        }, void 0),\n        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "font-mono text-white/60 truncate", children: "deployed" }, void 0, false, {\n          fileName: "/workspace/DFP-NEO-V2-fresh/components/FlightTile.tsx",\n          lineNumber: 406,\n          columnNumber: 21\n        }, void 0),',
    'jsxDevRuntimeExports.jsxDEV("div", { className: "overflow-hidden text-center whitespace-nowrap", children: [\n        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-white/80 font-medium text-sm", children: "DEPLOYMENT \u2022 deployed" }, void 0, false, {\n          fileName: "/workspace/DFP-NEO-V2-fresh/components/FlightTile.tsx",\n          lineNumber: 403,\n          columnNumber: 21\n        }, void 0),',
    "Patch 1: Tile text on one line (DEPLOYMENT \u2022 deployed)"
)

# ============================================================================
# PATCH 2: Use default 0800 times when saving deployment if user didn't change them
# Current: deploymentStartTime: ... ? deploymentStartTime : void 0
# New:     deploymentStartTime: ... ? (deploymentStartTime || "0800") : void 0
# ============================================================================
patch(
    'deploymentStartTime: eventType === "flight" && locationType === "Land Away" && isDeploy ? deploymentStartTime : void 0,',
    'deploymentStartTime: eventType === "flight" && locationType === "Land Away" && isDeploy ? (deploymentStartTime || "0800") : void 0,',
    "Patch 2a: Start Time defaults to 0800 if not entered"
)

patch(
    'deploymentEndTime: eventType === "flight" && locationType === "Land Away" && isDeploy ? deploymentEndTime : void 0,',
    'deploymentEndTime: eventType === "flight" && locationType === "Land Away" && isDeploy ? (deploymentEndTime || "0800") : void 0,',
    "Patch 2b: End Time defaults to 0800 if not entered"
)

# ============================================================================
# PATCH 3: Add "Deployed" to unavailability reasons list
# Current: ["TMUF", "TMUF - Ground Duties only", "Leave", "Appointment", "Other"]
# New:     ["TMUF", "TMUF - Ground Duties only", "Leave", "Appointment", "Other", "Deployed"]
# There are 2 occurrences - patch both
# ============================================================================
old3 = 'const unavailabilityReasons = ["TMUF", "TMUF - Ground Duties only", "Leave", "Appointment", "Other"];'
new3 = 'const unavailabilityReasons = ["TMUF", "TMUF - Ground Duties only", "Leave", "Appointment", "Other", "Deployed"];'
old3b = old3.encode('utf-8')
new3b = new3.encode('utf-8')
count3 = content.count(old3b)
if count3 >= 1:
    content = content.replace(old3b, new3b)
    changes += 1
    print(f"✅ Patch 3: Added 'Deployed' to unavailability reasons ({count3} occurrence(s))")
else:
    print("❌ Patch 3: unavailabilityReasons NOT found")

# ============================================================================
# PATCH 4: When a flight tile is dropped onto a Deployed row,
# add unavailability to the staff and trainee assigned:
#   - Start: flight end time (startTime + duration)
#   - End: deployment endTime
#   - Reason: "Deployed"
#   - Date: same date
#
# We inject this into handleScheduleUpdate, after the audit log forEach.
# The closing of handleScheduleUpdate is:
#   });
# };
# const handleNextDayScheduleUpdate
#
# We add a block that checks if newResourceId starts with "Deployed"
# and creates unavailability entries for staff/trainee.
# ============================================================================

old4 = (
    '        );'
    '\n      }'
    '\n    });'
    '\n  };'
    '\n  const handleNextDayScheduleUpdate = (updates) => {'
)

new4 = (
    '        );'
    '\n      }'
    '\n    });'
    '\n    updates.forEach((update) => {'
    '\n      if (update.newResourceId && update.newResourceId.startsWith("Deployed")) {'
    '\n        const event = currentScheduleForDate.find((e) => e.id === update.eventId);'
    '\n        if (event && event.type === "flight") {'
    '\n          const flightEndTime = (update.newStartTime ?? event.startTime) + event.duration;'
    '\n          const deploymentEvent = currentScheduleForDate.find('
    '\n            (e) => e.type === "deployment" && e.resourceId === update.newResourceId'
    '\n          );'
    '\n          const deployEndTime = deploymentEvent?.deploymentEndTime || "0800";'
    '\n          const deployEndHour = parseInt(deployEndTime.toString().replace(":", "").padStart(4, "0").slice(0, 2)) +'
    '\n            parseInt(deployEndTime.toString().replace(":", "").padStart(4, "0").slice(2, 4)) / 60;'
    '\n          const flightEndHour = Math.round(flightEndTime * 100) / 100;'
    '\n          const unavailPeriod = {'
    '\n            id: `deployed-${update.eventId}-${Date.now()}`,'
    '\n            date: event.date || date,'
    '\n            startTime: `${String(Math.floor(flightEndHour)).padStart(2, "0")}:${String(Math.round((flightEndHour % 1) * 60)).padStart(2, "0")}`,'
    '\n            endTime: `${String(Math.floor(deployEndHour)).padStart(2, "0")}:${String(Math.round((deployEndHour % 1) * 60)).padStart(2, "0")}`,'
    '\n            reason: "Deployed",'
    '\n            allDay: false'
    '\n          };'
    '\n          const staffNames = [event.instructor, event.pilot, event.student].filter(Boolean);'
    '\n          staffNames.forEach((personName) => {'
    '\n            const instructor = instructorsData.find((i) => i.name === personName || i.fullName === personName);'
    '\n            if (instructor) {'
    '\n              const updated = { ...instructor, unavailability: [...(instructor.unavailability || []), unavailPeriod] };'
    '\n              setInstructorsData((prev) => prev.map((i) => i.idNumber === instructor.idNumber ? updated : i));'
    '\n            }'
    '\n            const trainee = traineesData.find((t) => t.name === personName || t.fullName === personName);'
    '\n            if (trainee) {'
    '\n              const updated = { ...trainee, unavailability: [...(trainee.unavailability || []), unavailPeriod] };'
    '\n              setTraineesData((prev) => prev.map((t) => t.idNumber === trainee.idNumber ? updated : t));'
    '\n            }'
    '\n          });'
    '\n        }'
    '\n      }'
    '\n    });'
    '\n  };'
    '\n  const handleNextDayScheduleUpdate = (updates) => {'
)

patch(old4, new4, "Patch 4: Add Deployed unavailability on drag to Deployed row")

print(f"\n{'='*60}")
print(f"Total patches applied: {changes}/6")
print(f"{'='*60}")

if changes > 0:
    with open(BUNDLE_PATH, 'wb') as f:
        f.write(content)
    new_size = len(content)
    print(f"Bundle written: {new_size:,} bytes (diff: {new_size - original_size:+,})")
    
    print("\nVerification:")
    checks = [
        (b'DEPLOYMENT \xe2\x80\xa2 deployed', 'Tile text on one line'),
        (b'deploymentStartTime || "0800"', 'Start time default 0800'),
        (b'deploymentEndTime || "0800"', 'End time default 0800'),
        (b'"Deployed"', 'Deployed in unavailability reasons'),
        (b'startsWith("Deployed")', 'Drag to Deployed handler'),
        (b'reason: "Deployed"', 'Unavailability reason Deployed'),
    ]
    for search, label in checks:
        found = search in content
        print(f"  {'✅' if found else '❌'} {label}")
else:
    print("No changes - bundle NOT written.")