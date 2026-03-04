//
//  UnavailabilityViewModel.swift
//  DFP-NEO Mobile
//
//  Unavailability submission management
//

import Foundation
import SwiftUI

@MainActor
class UnavailabilityViewModel: ObservableObject {
    @Published var reasons: [UnavailabilityReason] = []
    @Published var selectedReason: UnavailabilityReason?
    @Published var startDate = Date()
    @Published var endDate = Date()
    @Published var notes = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var submissionResult: UnavailabilityResponse?
    @Published var showingResult = false
    
    private let api = APIService.shared
    
    // MARK: - Initialization
    
    func loadReasons() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let response: ReasonsResponse = try await api.get(endpoint: "/mobile/unavailability/reasons")
            reasons = response.reasons
            
            // Select first reason by default
            if selectedReason == nil {
                selectedReason = reasons.first
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    // MARK: - Quick Unavailability (Today 0800-2300)
    
    func submitQuickUnavailability() async {
        guard let reason = selectedReason else {
            errorMessage = "Please select a reason"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            let dateString = dateFormatter.string(from: Date())
            
            let request = QuickUnavailabilityRequest(
                date: dateString,
                reasonId: reason.id,
                notes: notes.isEmpty ? nil : notes
            )
            
            let response: UnavailabilityResponse = try await api.post(
                endpoint: "/mobile/unavailability/quick",
                body: request
            )
            
            submissionResult = response
            showingResult = true
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    // MARK: - Custom Unavailability
    
    func submitCustomUnavailability() async {
        guard let reason = selectedReason else {
            errorMessage = "Please select a reason"
            return
        }
        
        // Validate dates
        guard startDate < endDate else {
            errorMessage = "End date must be after start date"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            let request = UnavailabilityRequest(
                startDateTime: formatDateTime(startDate),
                endDateTime: formatDateTime(endDate),
                reasonId: reason.id,
                notes: notes.isEmpty ? nil : notes
            )
            
            let response: UnavailabilityResponse = try await api.post(
                endpoint: "/mobile/unavailability/create",
                body: request
            )
            
            submissionResult = response
            showingResult = true
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    // MARK: - Helpers
    
    func resetForm() {
        selectedReason = reasons.first
        startDate = Date()
        endDate = Date()
        notes = ""
        errorMessage = nil
        submissionResult = nil
        showingResult = false
    }
    
    private func formatDateTime(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
    
    var isFormValid: Bool {
        return selectedReason != nil && startDate < endDate
    }
}

// MARK: - Supporting Types

struct ReasonsResponse: Codable {
    let reasons: [UnavailabilityReason]
}