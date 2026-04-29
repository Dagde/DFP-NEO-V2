//
//  AlertsViewModel.swift
//  DFP-NEO Mobile
//
//  Manages fetching and responding to schedule change alerts
//

import Foundation
import Combine

@MainActor
class AlertsViewModel: ObservableObject {
    @Published var alerts: [AlertResponse] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil
    @Published var pendingCount: Int = 0

    private var pollTask: Task<Void, Never>? = nil
    private let pollInterval: TimeInterval = 15.0

    // MARK: - Lifecycle

    func startPolling() {
        pollTask?.cancel()
        pollTask = Task {
            while !Task.isCancelled {
                await loadAlerts()
                try? await Task.sleep(nanoseconds: UInt64(pollInterval * 1_000_000_000))
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    deinit {
        pollTask?.cancel()
    }

    // MARK: - Load Alerts

    func loadAlerts() async {
        guard let userId = APIService.shared.storedUserId, !userId.isEmpty else {
            return
        }

        if alerts.isEmpty { isLoading = true }

        do {
            let encodedUserId = userId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? userId
            let response: AlertsListResponse = try await APIService.shared.get(
                endpoint: "/alerts/\(encodedUserId)"
            )
            self.alerts = response.alerts
            self.pendingCount = response.alerts.filter { $0.isPending }.count
            self.errorMessage = nil
        } catch {
            if alerts.isEmpty {
                errorMessage = "Could not load alerts"
            }
            // Otherwise silent fail on polling
        }

        isLoading = false
    }

    // MARK: - Respond to Alert

    func respond(to alert: AlertResponse, status: AlertRecipientStatus) async {
        guard let userId = APIService.shared.storedUserId else { return }

        // Optimistically update UI
        if let idx = alerts.firstIndex(where: { $0.id == alert.id }) {
            let updatedAlert = AlertResponse(
                alertId: alert.alertId,
                eventId: alert.eventId,
                date: alert.date,
                sentAt: alert.sentAt,
                sentBy: alert.sentBy,
                recipients: alert.recipients,
                eventDetails: alert.eventDetails,
                myStatus: status.rawValue,
                respondedAt: ISO8601DateFormatter().string(from: Date())
            )
            alerts[idx] = updatedAlert
            pendingCount = alerts.filter { $0.isPending }.count
        }

        do {
            let body = AlertRespondRequest(userId: userId, status: status.rawValue)
            let _: AlertRespondResponse = try await APIService.shared.post(
                endpoint: "/alerts/\(alert.alertId)/respond",
                body: body
            )
            // Refresh from server to confirm
            await loadAlerts()
        } catch {
            // Revert optimistic update on error
            await loadAlerts()
            errorMessage = "Failed to respond. Please try again."
        }
    }
}