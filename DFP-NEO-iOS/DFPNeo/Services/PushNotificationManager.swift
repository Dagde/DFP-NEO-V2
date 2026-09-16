import Foundation
import SwiftUI
import UIKit
import UserNotifications
import Security

@MainActor
final class PushNotificationManager: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationManager()

    @Published private(set) var authorizationStatus: String = "unknown"
    @Published private(set) var alertSetting: String = "unknown"
    @Published private(set) var soundSetting: String = "unknown"
    @Published private(set) var badgeSetting: String = "unknown"
    @Published private(set) var entitlementEnvironment: String = "unknown"
    @Published private(set) var apnsRegistrationStatus: String = "not attempted"
    @Published private(set) var deviceTokenObtained: Bool = false
    @Published private(set) var deviceTokenPreview: String = "none"
    @Published private(set) var loggedInStableUserId: String = "none"
    @Published private(set) var tokenUploadAttempted: Bool = false
    @Published private(set) var tokenUploadEndpoint: String = "none"
    @Published private(set) var tokenUploadHTTPStatus: String = "not attempted"
    @Published private(set) var tokenUploadError: String = "none"
    @Published private(set) var lastRegistrationError: String = "none"
    @Published private(set) var requestedAlert: Bool = false
    @Published private(set) var requestedSound: Bool = false
    @Published private(set) var requestedBadge: Bool = false
    @Published private(set) var authorizationRequestExecuted: String = "not yet"

    private var deviceToken: String?
    private let expectedBundleId = "com.danieldawe.dfpneo"

    private override init() {
        super.init()
    }

    func configureOnLaunch() {
        UNUserNotificationCenter.current().delegate = self
        entitlementEnvironment = Self.currentApsEnvironment() ?? "missing"
        loggedInStableUserId = APIService.shared.storedUserId ?? "none"
        refreshNotificationSettings()
        registerForPushNotifications()
    }

    func setAuthenticatedUser(_ userId: String?) {
        loggedInStableUserId = userId?.isEmpty == false ? userId! : "none"
        Task {
            await uploadCurrentTokenIfPossible(reason: "auth state changed")
        }
    }

    func registerForPushNotifications() {
        Task {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            await updateSettings(settings)

            if settings.authorizationStatus == .notDetermined {
                requestedAlert = true
                requestedSound = true
                requestedBadge = true
                authorizationRequestExecuted = "yes - requested at app launch/re-register"
                do {
                    let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
                    print("🔔 [Push] requestAuthorization completed granted=\(granted)")
                } catch {
                    lastRegistrationError = error.localizedDescription
                    print("🔔 [Push] requestAuthorization failed: \(error.localizedDescription)")
                }
                await updateSettings(await center.notificationSettings())
            } else {
                authorizationRequestExecuted = "not needed - status \(authorizationStatus)"
            }

            apnsRegistrationStatus = "registerForRemoteNotifications called"
            await MainActor.run {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    func applicationDidRegisterForRemoteNotifications(deviceToken data: Data) {
        let token = data.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = token
        deviceTokenObtained = true
        deviceTokenPreview = Self.redactedToken(token)
        apnsRegistrationStatus = "didRegister callback received"
        lastRegistrationError = "none"
        print("🔔 [Push] APNs token obtained \(deviceTokenPreview)")

        Task {
            await uploadCurrentTokenIfPossible(reason: "APNs registration callback")
        }
    }

    func applicationDidFailToRegisterForRemoteNotifications(error: Error) {
        deviceTokenObtained = false
        apnsRegistrationStatus = "didFail callback received"
        lastRegistrationError = error.localizedDescription
        print("🔔 [Push] APNs registration failed: \(error.localizedDescription)")
    }

    func uploadCurrentTokenIfPossible(reason: String) async {
        guard let token = deviceToken, !token.isEmpty else {
            tokenUploadError = "No APNs token available for upload (\(reason))"
            return
        }
        guard let userId = APIService.shared.storedUserId, !userId.isEmpty else {
            tokenUploadError = "No authenticated user available for upload (\(reason))"
            return
        }
        guard let accessToken = APIService.shared.storedAccessToken, !accessToken.isEmpty else {
            tokenUploadError = "No access token available for upload (\(reason))"
            return
        }
        guard let baseURL = URL(string: APIService.shared.apiBaseURLString), !APIService.shared.apiBaseURLString.isEmpty else {
            tokenUploadError = "API base URL is not configured"
            return
        }
        guard let url = URL(string: "/api/mobile/notifications/device-token", relativeTo: baseURL) else {
            tokenUploadError = "Could not build token upload URL"
            return
        }

        loggedInStableUserId = userId
        tokenUploadAttempted = true
        tokenUploadEndpoint = url.absoluteString
        tokenUploadHTTPStatus = "pending"
        tokenUploadError = "none"

        let bundleId = Bundle.main.bundleIdentifier ?? expectedBundleId
        let payload = DeviceTokenUploadRequest(
            deviceToken: token,
            platform: "ios",
            appBundleId: bundleId,
            environment: "production",
            clientId: UIDevice.current.identifierForVendor?.uuidString ?? "",
            timeZone: TimeZone.current.identifier,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
            buildNumber: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        )

        do {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            request.httpBody = try JSONEncoder().encode(payload)

            print("🔔 [Push] Uploading APNs token userId=\(userId) bundleId=\(bundleId) environment=production endpoint=\(url.absoluteString)")
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                tokenUploadHTTPStatus = "invalid response"
                tokenUploadError = "Backend did not return HTTP response"
                return
            }

            tokenUploadHTTPStatus = "\(http.statusCode)"
            let bodyPreview = String(data: data.prefix(500), encoding: .utf8) ?? ""
            if (200...299).contains(http.statusCode) {
                tokenUploadError = "none"
                print("🔔 [Push] Token upload succeeded HTTP \(http.statusCode)")
            } else {
                tokenUploadError = bodyPreview.isEmpty ? "HTTP \(http.statusCode)" : bodyPreview
                print("🔔 [Push] Token upload failed HTTP \(http.statusCode): \(bodyPreview)")
            }
        } catch {
            tokenUploadHTTPStatus = "request failed"
            tokenUploadError = error.localizedDescription
            print("🔔 [Push] Token upload request failed: \(error.localizedDescription)")
        }
    }

    func refreshNotificationSettings() {
        Task {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            await updateSettings(settings)
        }
    }

    func setTestBadge() {
        UIApplication.shared.applicationIconBadgeNumber = 1
    }

    func clearTestBadge() {
        UIApplication.shared.applicationIconBadgeNumber = 0
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound, .badge])
    }

    private func updateSettings(_ settings: UNNotificationSettings) async {
        authorizationStatus = Self.describe(settings.authorizationStatus)
        alertSetting = Self.describe(settings.alertSetting)
        soundSetting = Self.describe(settings.soundSetting)
        badgeSetting = Self.describe(settings.badgeSetting)
        print("🔔 [Push] notification status=\(authorizationStatus) alert=\(alertSetting) sound=\(soundSetting) badge=\(badgeSetting)")
    }

    private static func describe(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "unknown"
        }
    }

    private static func describe(_ setting: UNNotificationSetting) -> String {
        switch setting {
        case .notSupported: return "notSupported"
        case .disabled: return "disabled"
        case .enabled: return "enabled"
        @unknown default: return "unknown"
        }
    }

    private static func redactedToken(_ token: String) -> String {
        guard token.count > 12 else { return "[redacted]" }
        return "\(token.prefix(6))...\(token.suffix(6))"
    }

    private static func currentApsEnvironment() -> String? {
        guard let task = SecTaskCreateFromSelf(nil),
              let value = SecTaskCopyValueForEntitlement(task, "aps-environment" as CFString, nil) else {
            return nil
        }
        return value as? String
    }
}

private struct DeviceTokenUploadRequest: Encodable {
    let deviceToken: String
    let platform: String
    let appBundleId: String
    let environment: String
    let clientId: String
    let timeZone: String
    let appVersion: String
    let buildNumber: String
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            PushNotificationManager.shared.applicationDidRegisterForRemoteNotifications(deviceToken: deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            PushNotificationManager.shared.applicationDidFailToRegisterForRemoteNotifications(error: error)
        }
    }
}
