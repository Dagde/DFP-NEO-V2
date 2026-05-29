//
//  AlertsViewModel.swift
//  DFP-NEO Mobile
//
//  Manages fetching and responding to schedule change alerts
//  Alerts API lives at /api/alerts/ (NOT /api/mobile/alerts/)
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
    // NOTE: Alerts API is at the configured API base /api/alerts/:userId
    // This is OUTSIDE the /api/mobile/ prefix - uses getRoot() method

    func loadAlerts() async {
        guard let userId = APIService.shared.getUserId(), !userId.isEmpty else {
            print("🔔 [Alerts] No userId available - skipping load")
            return
        }

        if alerts.isEmpty { isLoading = true }

        let encodedUserId = userId.addingPercentEncoding(
            withAllowedCharacters: .urlPathAllowed
        ) ?? userId

        let endpoint = "/alerts/\(encodedUserId)"
        print("🔔 [Alerts] Loading alerts from: \(APIService.shared.apiBaseURLString)/api\(endpoint)")

        do {
            let response: AlertsListResponse = try await APIService.shared.getRoot(endpoint)
            self.alerts = response.alerts
            self.pendingCount = response.alerts.filter { $0.isPending }.count
            self.errorMessage = nil
            print("🔔 [Alerts] ✅ Loaded \(response.alerts.count) alerts (\(pendingCount) pending)")

        } catch {
            print("🔔 [Alerts] ❌ Failed to load: \(error)")
            print("🔔 [Alerts] ❌ Error description: \(error.localizedDescription)")
            if alerts.isEmpty {
                errorMessage = "Could not load alerts"
            }
        }

        isLoading = false
    }

    // MARK: - Dismiss (delete) Alert from iOS list

    func dismiss(alert: AlertResponse) async {
        // Remove from local list immediately
        alerts.removeAll { $0.id == alert.id }
        pendingCount = alerts.filter { $0.isPending }.count

        // Optionally notify server (fire-and-forget, non-critical)
        guard let userId = APIService.shared.getUserId() else { return }
        do {
            try await APIService.shared.dismissAlert(alertId: alert.alertId, userId: userId)
        } catch {
            // Ignore - dismissal is local-only if server call fails
            print("🔔 [Alerts] Dismiss server call failed (ignored): \(error)")
        }
    }

    // MARK: - Respond to Alert

    func respond(to alert: AlertResponse, status: AlertRecipientStatus) async {
        guard let userId = APIService.shared.getUserId() else {
            print("🔔 [Alerts] No userId - cannot respond")
            return
        }

        print("🔔 [Alerts] Responding to alert \(alert.alertId) with status: \(status.rawValue)")

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
            let _: AlertRespondResponse = try await APIService.shared.postRoot(
                "/alerts/\(alert.alertId)/respond",
                body: body
            )
            print("🔔 [Alerts] ✅ Response recorded successfully")
            await loadAlerts()
        } catch {
            print("🔔 [Alerts] ❌ Failed to respond: \(error)")
            await loadAlerts()
            errorMessage = "Failed to respond. Please try again."
        }
    }
}
