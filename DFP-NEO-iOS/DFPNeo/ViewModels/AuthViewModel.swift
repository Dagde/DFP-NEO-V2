//
//  AuthViewModel.swift
//  DFP-NEO Mobile
//
//  Authentication state management
//

import Foundation
import SwiftUI

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isSessionLocked = false
    @Published var currentUser: User?
    @Published var errorMessage: String?
    @Published var isLoading = false
    @Published var biometricsEnabled = false

    private let authService = AuthService.shared
    private let biometricService = BiometricService.shared

    init() {
        checkExistingSession()
    }

    // MARK: - Authentication

    func login(userId: String, password: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await authService.login(userId: userId, password: password)
            currentUser = response.effectiveUser
            isAuthenticated = true
            isSessionLocked = false

            print("✅ Login successful for user: \(response.effectiveUser?.effectiveDisplayName ?? userId)")
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func logout() {
        Task {
            try? await authService.logout()
        }

        isAuthenticated = false
        isSessionLocked = false
        currentUser = nil
        biometricsEnabled = false
        UserDefaults.standard.set(false, forKey: "biometricsEnabled")
    }

    // MARK: - Biometric Authentication (disabled - was causing session lock loop)

    func unlockWithBiometrics() async {
        do {
            let success = try await biometricService.authenticate(
                reason: "Unlock DFP-NEO to view your schedule"
            )

            if success {
                _ = try await authService.refreshToken()
                isSessionLocked = false
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Session Management

    func lockSession() {
        // Biometric session locking disabled - was causing "No refresh token" loop
    }

    func checkSessionValidity() {
        Task {
            do {
                let isValid = try await authService.validateToken()
                if !isValid {
                    logout()
                }
            } catch {
                // Don't lock on error - just continue
                print("⚠️ Session validity check failed: \(error.localizedDescription)")
            }
        }
    }

    func resetActivityTimer() {
        // No-op - session timeout disabled
    }

    private func checkExistingSession() {
        // Clear any stale biometrics flag that could cause lock loop
        UserDefaults.standard.set(false, forKey: "biometricsEnabled")
        biometricsEnabled = false

        if authService.isAuthenticated() {
            isAuthenticated = true
            isSessionLocked = false

            Task {
                checkSessionValidity()
            }
        }
    }
}