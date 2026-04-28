//
//  UnavailabilityViewModel.swift
//  DFP-NEO Mobile
//
//  Unavailability submission management
//

import Foundation
import Combine
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
    @Published var rawServerError: String?
    
    private let api = APIService.shared
    
    // MARK: - Initialization
    
    func loadReasons() async {
        // CRITICAL FIX: Don't reload if already loaded - prevents flashing
        guard reasons.isEmpty else { return }
        
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
            print("❌ [Unavailability] Failed to load reasons: \(error)")
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
        rawServerError = nil
        
        print("✅ [Unavailability] Submitting QUICK unavailability")
        
        do {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            let dateString = dateFormatter.string(from: Date())
            
            let request = QuickUnavailabilityRequest(
                date: dateString,
                reasonId: reason.id,
                notes: notes.isEmpty ? nil : notes
            )
            
            print("📤 [Unavailability] Request: date=\(dateString), reasonId=\(reason.id)")
            
            let response: UnavailabilityResponse = try await api.post(
                endpoint: "/mobile/unavailability/quick",
                body: request
            )
            
            print("✅ [Unavailability] SUCCESS: \(response)")
            submissionResult = response
            showingResult = true
        } catch {
            errorMessage = error.localizedDescription
            rawServerError = String(describing: error)
            print("❌ [Unavailability] Failed to submit quick unavailability: \(error)")
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
        rawServerError = nil
        
        print("✅ [Unavailability] Submitting CUSTOM unavailability")
        
        do {
            let request = UnavailabilityRequest(
                startDateTime: formatDateTime(startDate),
                endDateTime: formatDateTime(endDate),
                reasonId: reason.id,
                notes: notes.isEmpty ? nil : notes
            )
            
            print("📤 [Unavailability] Request: start=\(formatDateTime(startDate)), end=\(formatDateTime(endDate)), reasonId=\(reason.id)")
            
            let response: UnavailabilityResponse = try await api.post(
                endpoint: "/mobile/unavailability/create",
                body: request
            )
            
            print("✅ [Unavailability] SUCCESS: \(response)")
            submissionResult = response
            showingResult = true
        } catch {
            errorMessage = error.localizedDescription
            rawServerError = String(describing: error)
            print("❌ [Unavailability] Failed to submit custom unavailability: \(error)")
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
        rawServerError = nil
        // NOTE: do NOT reset reasons array - keep them cached
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