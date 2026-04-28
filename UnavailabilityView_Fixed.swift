import SwiftUI

struct UnavailabilityView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = UnavailabilityViewModel()
    @State private var showingQuickForm = true
    
    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.1, green: 0.1, blue: 0.2),
                    Color(red: 0, green: 0, blue: 0)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            if viewModel.isLoading {
                loadingView
            } else {
                VStack(spacing: 0) {
                    // Header
                    headerView
                    
                    // Tab selector
                    tabSelector
                    
                    // Content
                    ScrollView {
                        VStack(spacing: 20) {
                            if showingQuickForm {
                                quickUnavailabilityForm
                            } else {
                                customUnavailabilityForm
                            }
                        }
                        .padding()
                    }
                }
                .alert("Unavailability Submitted", isPresented: $viewModel.showingResult) {
                    Button("OK") {
                        viewModel.resetForm()
                        dismiss()
                    }
                } message: {
                    if let result = viewModel.submissionResult {
                        Text(resultMessage(result))
                    }
                }
                .task {
                    await viewModel.loadReasons()
                }
            }
        }
    }
    
    // MARK: - Header
    
    private var headerView: some View {
        HStack {
            Button(action: { dismiss() }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(.white)
            }
            
            Spacer()
            
            Text("Unavailability")
                .font(.headline)
                .foregroundColor(.white)
            
            Spacer()
            Spacer()
        }
        .padding()
        .background(Color.black.opacity(0.3))
    }
    
    // MARK: - Tab Selector
    
    private var tabSelector: some View {
        HStack(spacing: 0) {
            TabButton(
                title: "Quick",
                isSelected: showingQuickForm,
                action: { withAnimation { showingQuickForm = true } }
            )
            
            TabButton(
                title: "Custom",
                isSelected: !showingQuickForm,
                action: { withAnimation { showingQuickForm = false } }
            )
        }
        .background(Color.black.opacity(0.2))
    }
    
    // MARK: - Quick Unavailability
    
    private var quickUnavailabilityForm: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Info card
            InfoCard(
                icon: "clock.fill",
                title: "Quick Unavailability",
                message: "Report unavailability for today from 0800 to 2300"
            )
            
            // Reason picker
            VStack(alignment: .leading, spacing: 8) {
                Text("REASON")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white.opacity(0.7))
                    .tracking(2)
                
                Menu {
                    ForEach(viewModel.reasons) { reason in
                        Button(action: { viewModel.selectedReason = reason }) {
                            Text(reason.description)
                        }
                    }
                } label: {
                    HStack {
                        Text(viewModel.selectedReason?.description ?? "Select reason")
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .foregroundColor(.white.opacity(0.6))
                    }
                    .padding()
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                    )
                }
            }
            
            // Notes
            VStack(alignment: .leading, spacing: 8) {
                Text("NOTES (OPTIONAL)")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white.opacity(0.7))
                    .tracking(2)
                
                TextEditor(text: $viewModel.notes)
                    .frame(height: 100)
                    .padding(8)
                    .background(Color.white.opacity(0.85))
                    .foregroundColor(.black)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                    )
            }
            
            // Error message with debug info
            if let error = viewModel.errorMessage {
                VStack(alignment: .leading, spacing: 8) {
                    Text(error)
                        .font(.subheadline)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.leading)
                    
                    if let rawError = viewModel.rawServerError {
                        Text("Debug: \(rawError)")
                            .font(.caption)
                            .foregroundColor(.orange.opacity(0.8))
                            .multilineTextAlignment(.leading)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // Submit button
            Button(action: { Task { await viewModel.submitQuickUnavailability() } }) {
                HStack {
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Submit")
                            .font(.headline)
                            .foregroundColor(.white)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    viewModel.isLoading
                        ? Color.gray
                        : LinearGradient(
                            gradient: Gradient(colors: [Color.blue, Color.purple]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                )
                .cornerRadius(10)
            }
            .disabled(viewModel.isLoading)
        }
    }
    
    // MARK: - Custom Unavailability
    
    private var customUnavailabilityForm: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Info card
            InfoCard(
                icon: "calendar",
                title: "Custom Unavailability",
                message: "Specify exact start and end times for your unavailability"
            )
            
            // Start date/time
            VStack(alignment: .leading, spacing: 8) {
                Text("START DATE & TIME")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white.opacity(0.7))
                    .tracking(2)
                
                DatePicker("", selection: $viewModel.startDate)
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .preferredColorScheme(.dark)
                    .padding()
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(8)
            }
            
            // End date/time
            VStack(alignment: .leading, spacing: 8) {
                Text("END DATE & TIME")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white.opacity(0.7))
                    .tracking(2)
                
                DatePicker("", selection: $viewModel.endDate)
                    .datePickerStyle(.compact)
                    .labelsHidden()
                    .preferredColorScheme(.dark)
                    .padding()
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(8)
            }
            
            // Reason picker
            VStack(alignment: .leading, spacing: 8) {
                Text("REASON")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white.opacity(0.7))
                    .tracking(2)
                
                Menu {
                    ForEach(viewModel.reasons) { reason in
                        Button(action: { viewModel.selectedReason = reason }) {
                            Text(reason.description)
                        }
                    }
                } label: {
                    HStack {
                        Text(viewModel.selectedReason?.description ?? "Select reason")
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .foregroundColor(.white.opacity(0.6))
                    }
                    .padding()
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                    )
                }
            }
            
            // Notes
            VStack(alignment: .leading, spacing: 8) {
                Text("NOTES (OPTIONAL)")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white.opacity(0.7))
                    .tracking(2)
                
                TextEditor(text: $viewModel.notes)
                    .frame(height: 100)
                    .padding(8)
                    .background(Color.white.opacity(0.85))
                    .foregroundColor(.black)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                    )
            }
            
            // Error message with debug info
            if let error = viewModel.errorMessage {
                VStack(alignment: .leading, spacing: 8) {
                    Text(error)
                        .font(.subheadline)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.leading)
                    
                    if let rawError = viewModel.rawServerError {
                        Text("Debug: \(rawError)")
                            .font(.caption)
                            .foregroundColor(.orange.opacity(0.8))
                            .multilineTextAlignment(.leading)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // Submit button
            Button(action: { Task { await viewModel.submitCustomUnavailability() } }) {
                HStack {
                    if viewModel.isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .black))
                    } else {
                        Text("SUBMIT UNAVAILABILITY")
                            .fontWeight(.bold)
                            .tracking(1)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(viewModel.isFormValid ? Color.white : Color.white.opacity(0.3))
                .foregroundColor(.black)
                .cornerRadius(8)
            }
            .disabled(viewModel.isLoading || !viewModel.isFormValid)
        }
    }
    
    // MARK: - Loading
    
    private var loadingView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                .scaleEffect(1.5)
            
            Text("Loading...")
                .foregroundColor(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Result Message (FIXED)
    
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
}

// MARK: - Subviews

struct TabButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    isSelected
                        ? Color.blue.opacity(0.3)
                        : Color.clear
                )
                .overlay(
                    Rectangle()
                        .fill(Color.blue)
                        .frame(height: 2)
                        .opacity(isSelected ? 1 : 0),
                    alignment: .bottom
                )
        }
    }
}

struct InfoCard: View {
    let icon: String
    let title: String
    let message: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding()
        .background(Color.blue.opacity(0.1))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.blue.opacity(0.3), lineWidth: 1)
        )
    }
}

#Preview {
    UnavailabilityView()
}