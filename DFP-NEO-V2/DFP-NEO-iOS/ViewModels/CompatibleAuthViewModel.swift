import Foundation
import Combine

@MainActor
final class AuthViewModel: ObservableObject {

    // Login fields
    @Published var userId: String = ""
    @Published var password: String = ""

    // UI flags
    @Published var showBiometricPrompt: Bool = false
    @Published var enableBiometricLogin: Bool = false

    // Error handling
    @Published var errorMessage: String? = nil

    // App state
    @Published var isLoggingIn: Bool = false
    @Published var isLoading: Bool = false       // Alias used by LoginView
    @Published var isAuthenticated: Bool = false
    @Published var isSessionLocked: Bool = false  // Always false - biometric locking disabled
    @Published var currentUser: User? = nil

    private let authService = AuthService()

    init() {
        // Clear any stale biometrics flag that caused session lock loop
        UserDefaults.standard.set(false, forKey: "biometricsEnabled")
    }

    func login() async {
        isLoggingIn = true
        isLoading = true
        errorMessage = nil
        defer {
            isLoggingIn = false
            isLoading = false
        }

        do {
            let resp = try await authService.login(userId: userId, password: password)

            // ✅ Save tokens to APIService (UserDefaults-backed) so all API calls work
            APIService.shared.setTokens(access: resp.accessToken, refresh: resp.refreshToken)
            APIService.shared.setUserId(resp.user.userId)

            self.currentUser = resp.user
            self.isAuthenticated = true
            self.isSessionLocked = false

            print("✅ Login successful for user: \(resp.user.displayName)")
            print("   - userId: \(resp.user.userId)")
            print("   - Tokens stored in APIService ✅")

        } catch {
            self.errorMessage = error.localizedDescription
            self.isAuthenticated = false
            self.currentUser = nil

            print("❌ Login failed: \(error.localizedDescription)")
        }
    }

    func login(userId: String, password: String) async {
        self.userId = userId
        self.password = password
        await login()
    }

    func loginWithBiometrics() {
        showBiometricPrompt = true
    }

    func unlockWithBiometrics() async {
        // Biometric unlock disabled - just clear the lock
        isSessionLocked = false
    }

    func lockSession() {
        // Session locking disabled - was causing "No refresh token" loop
    }

    func logout() {
        // Clear tokens from APIService
        APIService.shared.clearTokens()

        isAuthenticated = false
        isSessionLocked = false
        currentUser = nil
        userId = ""
        password = ""
        errorMessage = nil
        UserDefaults.standard.set(false, forKey: "biometricsEnabled")

        print("👋 User logged out - tokens cleared")
    }
}