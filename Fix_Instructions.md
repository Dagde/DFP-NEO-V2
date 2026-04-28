# UnavailabilityView.swift - Minimal Fix Instructions

## Overview
Your current file has errors because I over-engineered the fix. Only 3 specific lines need to be changed.

## Errors You're Seeing
1. **"Result values in '?' expression have mismatched types 'Color' and 'LinearGradient'"**
   - This is likely in a submit button that uses a ternary operator
   
2. **"Left side of nil coalescing operator '??' has non-optional type 'String'"**
   - This is in ScheduleView.swift (separate file)

## The Issue
The original file I extracted from `xcode_export_full.txt` has a DIFFERENT structure than your current file:
- Original uses: `Color.black.ignoresSafeArea()` + `NavigationView` + ` Picker` tabs
- Your file uses: `LinearGradient` + custom tab buttons + different loading view

**I need to see YOUR current file to give you the exact fix.**

## What I Need From You
Please upload or paste your CURRENT `Views/UnavailabilityView.swift` file so I can:
1. See the exact code structure
2. Provide the minimal, precise fixes needed
3. Avoid breaking changes

## Alternative: Manual Fix
If you prefer to fix it yourself, here are the 3 changes needed:

### Change 1: Quick Unavailability Notes Color
Find the Notes section in `quickUnavailabilityForm` (around line 3089):
```swift
// BEFORE:
TextEditor(text: $viewModel.notes)
    .frame(height: 100)
    .padding(8)
    .background(Color.white.opacity(0.1))
    .foregroundColor(.white)  // ← CHANGE THIS
    .cornerRadius(8)

// AFTER:
TextEditor(text: $viewModel.notes)
    .frame(height: 100)
    .padding(8)
    .background(Color.white.opacity(0.85))
    .foregroundColor(.black)  // ← CHANGED TO BLACK
    .cornerRadius(8)
```

### Change 2: Custom Unavailability Notes Color
Find the Notes section in `customUnavailabilityForm` (around line 3226):
```swift
// BEFORE:
TextEditor(text: $viewModel.notes)
    .frame(height: 100)
    .padding(8)
    .background(Color.white.opacity(0.1))
    .foregroundColor(.white)  // ← CHANGE THIS
    .cornerRadius(8)

// AFTER:
TextEditor(text: $viewModel.notes)
    .frame(height: 100)
    .padding(8)
    .background(Color.white.opacity(0.85))
    .foregroundColor(.black)  // ← CHANGED TO BLACK
    .cornerRadius(8)
```

### Change 3: New resultMessage() Function
Find the `resultMessage()` function (around line 3292) and REPLACE it entirely:
```swift
private func resultMessage(_ result: UnavailabilityResponse) -> String {
    // Format the unavailability period dates
    let periodStr = formatResponsePeriod(
        start: result.startDateTime,
        end: result.endDateTime
    )
    
    // Format the registration timestamp
    let registeredStr = formatResponseTimestamp(result.submittedAt)
    
    var message = "✅ Unavailability successfully registered\n\n"
    message += "Period: \(periodStr)\n"
    message += "Registered: \(registeredStr)"
    return message
}

/// Converts ISO-8601 start/end strings into a human-readable period.
/// e.g. "15 Jan 2025, 0800 – 2300"
private func formatResponsePeriod(start: String, end: String) -> String {
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    
    // Try with fractional seconds first, then without
    func parseDate(_ str: String) -> Date? {
        if let d = iso.date(from: str) { return d }
        let iso2 = ISO8601DateFormatter()
        iso2.formatOptions = [.withInternetDateTime]
        return iso2.date(from: str)
    }
    
    guard let startDate = parseDate(start),
          let endDate   = parseDate(end) else {
        // Fallback: just show raw strings trimmed to date part
        return "\(start.prefix(10)) – \(end.prefix(10))"
    }
    
    let dateFmt = DateFormatter()
    dateFmt.dateFormat = "d MMM yyyy"
    dateFmt.timeZone   = TimeZone.current
    
    let timeFmt = DateFormatter()
    timeFmt.dateFormat = "HHmm"
    timeFmt.timeZone   = TimeZone.current
    
    let startDateStr = dateFmt.string(from: startDate)
    let startTimeStr = timeFmt.string(from: startDate)
    let endDateStr   = dateFmt.string(from: endDate)
    let endTimeStr   = timeFmt.string(from: endDate)
    
    if startDateStr == endDateStr {
        // Same day: "15 Jan 2025, 0800 – 2300"
        return "\(startDateStr), \(startTimeStr) – \(endTimeStr)"
    } else {
        // Different days: "15 Jan 2025 0800 – 16 Jan 2025 2300"
        return "\(startDateStr) \(startTimeStr) – \(endDateStr) \(endTimeStr)"
    }
}

/// Converts an ISO-8601 submission timestamp to local time.
/// e.g. "15 Jan 2025 at 14:32"
private func formatResponseTimestamp(_ isoString: String) -> String {
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    
    func parseDate(_ str: String) -> Date? {
        if let d = iso.date(from: str) { return d }
        let iso2 = ISO8601DateFormatter()
        iso2.formatOptions = [.withInternetDateTime]
        return iso2.date(from: str)
    }
    
    guard let date = parseDate(isoString) else {
        return isoString.prefix(16).description
    }
    
    let fmt = DateFormatter()
    fmt.dateFormat = "d MMM yyyy 'at' HH:mm"
    fmt.timeZone   = TimeZone.current
    return fmt.string(from: date)
}
```

## ScheduleView.swift Error
The error about `??` with non-optional String is in ScheduleView.swift, not UnavailabilityView.swift.
This is a separate file that needs fixing. I'll need to see that file too if you want it fixed.