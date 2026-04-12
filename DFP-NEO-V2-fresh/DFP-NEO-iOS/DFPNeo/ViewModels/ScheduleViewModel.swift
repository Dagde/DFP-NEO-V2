//
//  ScheduleViewModel.swift
//  DFP-NEO Mobile
//
//  Schedule management and navigation
//

import Foundation
import SwiftUI

@MainActor
class ScheduleViewModel: ObservableObject {
    @Published var currentSchedule: DailySchedule?
    @Published var currentDate = Date()
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isRefreshing = false
    @Published var lastUpdated: Date?
    @Published var isOffline = false
    
    private let api = APIService.shared
    private let calendar = Calendar.current
    
    // MARK: - Schedule Loading
    
    func loadSchedule(for date: Date? = nil) async {
        let targetDate = date ?? currentDate
        isLoading = true
        errorMessage = nil
        isOffline = false
        
        do {
            let dateString = formatDate(targetDate)
            let response: ScheduleResponse = try await api.get(
                endpoint: "/mobile/schedule?date=\(dateString)"
            )
            
            if let schedule = response.schedule {
                currentSchedule = schedule
                currentDate = targetDate
                lastUpdated = Date()
            } else {
                // Day not published
                currentSchedule = nil
                errorMessage = response.message ?? "Schedule not yet published"
            }
        } catch {
            errorMessage = error.localizedDescription
            isOffline = true
        }
        
        isLoading = false
    }
    
    func refreshSchedule() async {
        isRefreshing = true
        await loadSchedule(for: currentDate)
        isRefreshing = false
    }
    
    // MARK: - Date Navigation
    
    func goToNextDay() async {
        guard let nextDate = calendar.date(byAdding: .day, value: 1, to: currentDate) else {
            return
        }
        
        await loadSchedule(for: nextDate)
    }
    
    func goToPreviousDay() async {
        // Limit to 7 days in the past
        let sevenDaysAgo = calendar.date(byAdding: .day, value: -7, to: Date()) ?? Date()
        
        guard let previousDate = calendar.date(byAdding: .day, value: -1, to: currentDate),
              previousDate >= sevenDaysAgo else {
            errorMessage = "Cannot view schedules older than 7 days"
            return
        }
        
        await loadSchedule(for: previousDate)
    }
    
    func goToToday() async {
        await loadSchedule(for: Date())
    }
    
    // MARK: - Helpers
    
    var canGoBack: Bool {
        let sevenDaysAgo = calendar.date(byAdding: .day, value: -7, to: Date()) ?? Date()
        guard let previousDate = calendar.date(byAdding: .day, value: -1, to: currentDate) else {
            return false
        }
        return previousDate >= sevenDaysAgo
    }
    
    var isToday: Bool {
        calendar.isDateInToday(currentDate)
    }
    
    var displayDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        return formatter.string(from: currentDate)
    }
    
    var displayTime: String {
        guard let updated = lastUpdated else {
            return "Not updated"
        }
        
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return "Updated: \(formatter.string(from: updated))"
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}