// ============================================================
// PATCH FILE - DFP-NEO UnavailabilityView.swift Fixes
// ============================================================
// Apply these two changes to Views/UnavailabilityView.swift:
//
// CHANGE 1: Fix notes text color (white-on-white → black)
//   TWO locations to change – both quickUnavailabilityForm
//   AND customUnavailabilityForm have the same TextEditor.
//
// CHANGE 2: Fix success popup message (remove Status/ID,
//   show unavailability period + registration timestamp)
// ============================================================

// ─────────────────────────────────────────────────────────────
// CHANGE 1A  (quickUnavailabilityForm – around line 3089)
// ─────────────────────────────────────────────────────────────
//
// FIND this block (inside quickUnavailabilityForm):
//
//     TextEditor(text: $viewModel.notes)
//         .frame(height: 100)
//         .padding(8)
//         .background(Color.white.opacity(0.1))
//         .foregroundColor(.white)          // <-- PROBLEM
//         .cornerRadius(8)
//         .overlay(
//             RoundedRectangle(cornerRadius: 8)
//                 .stroke(Color.white.opacity(0.2), lineWidth: 1)
//         )
//
// REPLACE WITH:
//
//     TextEditor(text: $viewModel.notes)
//         .frame(height: 100)
//         .padding(8)
//         .background(Color.white.opacity(0.85))
//         .foregroundColor(.black)          // <-- FIXED
//         .cornerRadius(8)
//         .overlay(
//             RoundedRectangle(cornerRadius: 8)
//                 .stroke(Color.white.opacity(0.2), lineWidth: 1)
//         )

// ─────────────────────────────────────────────────────────────
// CHANGE 1B  (customUnavailabilityForm – around line 3226)
// ─────────────────────────────────────────────────────────────
//
// FIND this block (inside customUnavailabilityForm – second
// TextEditor, identical pattern):
//
//     TextEditor(text: $viewModel.notes)
//         .frame(height: 100)
//         .padding(8)
//         .background(Color.white.opacity(0.1))
//         .foregroundColor(.white)          // <-- PROBLEM
//         .cornerRadius(8)
//         .overlay(
//             RoundedRectangle(cornerRadius: 8)
//                 .stroke(Color.white.opacity(0.2), lineWidth: 1)
//         )
//
// REPLACE WITH:
//
//     TextEditor(text: $viewModel.notes)
//         .frame(height: 100)
//         .padding(8)
//         .background(Color.white.opacity(0.85))
//         .foregroundColor(.black)          // <-- FIXED
//         .cornerRadius(8)
//         .overlay(
//             RoundedRectangle(cornerRadius: 8)
//                 .stroke(Color.white.opacity(0.2), lineWidth: 1)
//         )

// ─────────────────────────────────────────────────────────────
// CHANGE 2  (resultMessage function – around line 3292)
// ─────────────────────────────────────────────────────────────
//
// FIND this entire function:
//
//     private func resultMessage(_ result: UnavailabilityResponse) -> String {
//         var message = "Unavailability registered in DFP-NEO\n\n"
//         message += "Status: \(result.status)\n"
//         message += "ID: \(result.id)\n"
//
//         if let serverMessage = result.message {
//             message += "\n\(serverMessage)"
//         }
//
//         return message
//     }
//
// REPLACE WITH:
//
//     private func resultMessage(_ result: UnavailabilityResponse) -> String {
//         // Format the unavailability period dates
//         let periodStr = formatResponsePeriod(
//             start: result.startDateTime,
//             end: result.endDateTime
//         )
//
//         // Format the registration timestamp
//         let registeredStr = formatResponseTimestamp(result.submittedAt)
//
//         var message = "✅ Unavailability successfully registered\n\n"
//         message += "Period: \(periodStr)\n"
//         message += "Registered: \(registeredStr)"
//         return message
//     }
//
//     /// Converts ISO-8601 start/end strings into a human-readable period.
//     /// e.g. "15 Jan 2025, 0800 – 2300"
//     private func formatResponsePeriod(start: String, end: String) -> String {
//         let iso = ISO8601DateFormatter()
//         iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
//
//         // Try with fractional seconds first, then without
//         func parseDate(_ str: String) -> Date? {
//             if let d = iso.date(from: str) { return d }
//             let iso2 = ISO8601DateFormatter()
//             iso2.formatOptions = [.withInternetDateTime]
//             return iso2.date(from: str)
//         }
//
//         guard let startDate = parseDate(start),
//               let endDate   = parseDate(end) else {
//             // Fallback: just show raw strings trimmed to date part
//             return "\(start.prefix(10)) – \(end.prefix(10))"
//         }
//
//         let dateFmt = DateFormatter()
//         dateFmt.dateFormat = "d MMM yyyy"
//         dateFmt.timeZone   = TimeZone.current
//
//         let timeFmt = DateFormatter()
//         timeFmt.dateFormat = "HHmm"
//         timeFmt.timeZone   = TimeZone.current
//
//         let startDateStr = dateFmt.string(from: startDate)
//         let startTimeStr = timeFmt.string(from: startDate)
//         let endDateStr   = dateFmt.string(from: endDate)
//         let endTimeStr   = timeFmt.string(from: endDate)
//
//         if startDateStr == endDateStr {
//             // Same day: "15 Jan 2025, 0800 – 2300"
//             return "\(startDateStr), \(startTimeStr) – \(endTimeStr)"
//         } else {
//             // Different days: "15 Jan 2025 0800 – 16 Jan 2025 2300"
//             return "\(startDateStr) \(startTimeStr) – \(endDateStr) \(endTimeStr)"
//         }
//     }
//
//     /// Converts an ISO-8601 submission timestamp to local time.
//     /// e.g. "15 Jan 2025 at 14:32"
//     private func formatResponseTimestamp(_ isoString: String) -> String {
//         let iso = ISO8601DateFormatter()
//         iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
//
//         func parseDate(_ str: String) -> Date? {
//             if let d = iso.date(from: str) { return d }
//             let iso2 = ISO8601DateFormatter()
//             iso2.formatOptions = [.withInternetDateTime]
//             return iso2.date(from: str)
//         }
//
//         guard let date = parseDate(isoString) else {
//             return isoString.prefix(16).description
//         }
//
//         let fmt = DateFormatter()
//         fmt.dateFormat = "d MMM yyyy 'at' HH:mm"
//         fmt.timeZone   = TimeZone.current
//         return fmt.string(from: date)
//     }