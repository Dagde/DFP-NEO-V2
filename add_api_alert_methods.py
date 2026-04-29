#!/usr/bin/env python3

with open('/workspace/dfp-neo-deployment/DFP-NEO-iOS/DFPNeo/Services/APIService.swift', 'r', encoding='utf-8') as f:
    content = f.read()

alert_methods = '''
    // MARK: - Alert API methods

    /// Fetch all alerts for a given userId
    func getAlerts(userId: String) async throws -> AlertsListResponse {
        return try await get(endpoint: "/alerts/\\(userId)")
    }

    /// Respond to an alert (accept or reject)
    func respondToAlert(alertId: String, eventId: String, date: String, userId: String, status: String) async throws -> AlertRespondResponse {
        let body = AlertRespondRequest(
            alertId: alertId,
            eventId: eventId,
            date: date,
            userId: userId,
            status: status
        )
        return try await post(endpoint: "/alerts/\\(alertId)/respond", body: body)
    }

'''

# Insert before the last closing brace
idx = content.rfind('}')
new_content = content[:idx] + alert_methods + content[idx:]

with open('/workspace/dfp-neo-deployment/DFP-NEO-iOS/DFPNeo/Services/APIService.swift', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESS: Alert methods added to APIService.swift")