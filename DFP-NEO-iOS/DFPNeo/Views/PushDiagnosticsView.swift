//
//  PushDiagnosticsView.swift
//  DFP-NEO Mobile
//

import SwiftUI

struct PushDiagnosticsView: View {
    @EnvironmentObject var pushManager: PushNotificationManager

    var body: some View {
        NavigationView {
            List {
                Section("Notification Permission") {
                    diagnosticRow("Authorization status", pushManager.authorizationStatus)
                    diagnosticRow(".alert setting", pushManager.alertSetting)
                    diagnosticRow(".sound setting", pushManager.soundSetting)
                    diagnosticRow(".badge setting", pushManager.badgeSetting)
                    diagnosticRow("Authorization request executed", pushManager.authorizationRequestExecuted)
                    diagnosticRow(".alert requested", pushManager.requestedAlert ? "YES" : "NO")
                    diagnosticRow(".sound requested", pushManager.requestedSound ? "YES" : "NO")
                    diagnosticRow(".badge requested", pushManager.requestedBadge ? "YES" : "NO")
                }

                Section("APNs Registration") {
                    diagnosticRow("aps-environment entitlement", pushManager.entitlementEnvironment)
                    diagnosticRow("APNs registration callback", pushManager.apnsRegistrationStatus)
                    diagnosticRow("APNs registration error", pushManager.lastRegistrationError)
                    diagnosticRow("Device token obtained", pushManager.deviceTokenObtained ? "YES" : "NO")
                    diagnosticRow("Device token preview", pushManager.deviceTokenPreview)
                }

                Section("Backend Token Upload") {
                    diagnosticRow("Logged-in stable userId", pushManager.loggedInStableUserId)
                    diagnosticRow("Token upload attempted", pushManager.tokenUploadAttempted ? "YES" : "NO")
                    diagnosticRow("Token upload endpoint", pushManager.tokenUploadEndpoint)
                    diagnosticRow("Token upload HTTP status", pushManager.tokenUploadHTTPStatus)
                    diagnosticRow("Token upload error", pushManager.tokenUploadError)
                }

                Section("Actions") {
                    Button("Refresh Diagnostics") {
                        pushManager.refreshNotificationSettings()
                    }

                    Button("Re-register Push Notifications") {
                        pushManager.registerForPushNotifications()
                    }

                    Button("Test Badge") {
                        pushManager.setTestBadge()
                    }

                    Button("Clear Test Badge") {
                        pushManager.clearTestBadge()
                    }
                }
            }
            .navigationTitle("Push Diagnostics")
            .preferredColorScheme(.dark)
        }
    }

    private func diagnosticRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value.isEmpty ? "none" : value)
                .font(.body.monospaced())
                .textSelection(.enabled)
        }
        .padding(.vertical, 3)
    }
}

#Preview {
    PushDiagnosticsView()
        .environmentObject(PushNotificationManager.shared)
}
