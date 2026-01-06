//
//  UnavailabilityView.swift
//  DFP-NEO Mobile
//
//  Unavailability submission interface
//

import SwiftUI

struct UnavailabilityView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel = UnavailabilityViewModel()
    @State private var selectedTab = 0
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.black.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Tab selector
                    Picker("Type", selection: $selectedTab) {
                        Text("Quick").tag(0)
                        Text("Custom").tag(1)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    .padding()
                    
                    // Content
                    if viewModel.isLoading && viewModel.reasons.isEmpty {
                        loadingView
                    } else {
                        ScrollView {
                            VStack(spacing: 20) {
                                if selectedTab == 0 {
                                    quickUnavailabilityForm
                                } else {
                                    customUnavailabilityForm
                                }
                            }
                            .padding()
                        }
                    }
                }
            }
            .navigationTitle("Report Unavailability")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
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
    
    // MARK: - Quick Unavailability Form
    
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
                    .background(Color.white.opacity(0.1))
                    .foregroundColor(.white)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                    )
            }
            
            // Error message
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.subheadline)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
            }
            
            // Submit button
            Button(action: { Task { await viewModel.submitQuickUnavailability() } }) {
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
                .background(viewModel.selectedReason != nil ? Color.white : Color.white.opacity(0.3))
                .foregroundColor(.black)
                .cornerRadius(8)
            }
            .disabled(viewModel.isLoading || viewModel.selectedReason == nil)
        }
    }
    
    // MARK: - Custom Unavailability Form
    
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
                    .colorScheme(.dark)
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
                    .colorScheme(.dark)
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
                    .background(Color.white.opacity(0.1))
                    .foregroundColor(.white)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                    )
            }
            
            // Error message
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.subheadline)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
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
    
    // MARK: - Supporting Views
    
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
    
    private func resultMessage(_ result: UnavailabilityResponse) -> String {
        var message = "Unavailability registered in DFP-NEO\n\n"
        message += "Status: \(result.status.rawValue)\n"
        message += "ID: \(result.id)\n"
        
        if let serverMessage = result.message {
            message += "\n\(serverMessage)"
        }
        
        return message
    }
}

// MARK: - Info Card

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