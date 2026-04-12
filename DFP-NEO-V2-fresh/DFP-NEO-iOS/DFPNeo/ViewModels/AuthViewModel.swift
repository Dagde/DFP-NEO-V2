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
    private var sessionTimer: Timer?
    private let sessionTimeout: TimeInterval = 180 // 3 minutes
    private var lastActivityTime = Date()
    
    init() {
        checkExistingSession()
        setupSessionMonitoring()
    }
    
    // MARK: - Authentication
    
    func login(userId: String, password: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let response = try await authService.login(userId: userId, password: password)
            currentUser = response.user
            isAuthenticated = true
            
            // Prompt for biometric setup after first successful login
            if biometricService.isBiometricAvailable && !biometricsEnabled {
                await promptBiometricSetup()
            }
            
            resetActivityTimer()
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
        sessionTimer?.invalidate()
    }
    
    // MARK: - Biometric Authentication
    
    func promptBiometricSetup() async {
        let biometricType = biometricService.biometricType
        let message: String
        
        switch biometricType {
        case .faceID:
            message = "Enable Face ID for quick and secure access?"
        case .touchID:
            message = "Enable Touch ID for quick and secure access?"
        case .none:
            return
        }
        
        // In a real app, show an alert here
        // For now, just enable it
        biometricsEnabled = true
        UserDefaults.standard.set(true, forKey: "biometricsEnabled")
    }
    
    func unlockWithBiometrics() async {
        do {
            let success = try await biometricService.authenticate(
                reason: "Unlock DFP-NEO to view your schedule"
            )
            
            if success {
                // Refresh token to ensure it's still valid
                _ = try await authService.refreshToken()
                isSessionLocked = false
                resetActivityTimer()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
    
    // MARK: - Session Management
    
    func lockSession() {
        if isAuthenticated && biometricsEnabled {
            isSessionLocked = true
        }
    }
    
    func checkSessionValidity() {
        Task {
            do {
                let isValid = try await authService.validateToken()
                if !isValid {
                    logout()
                }
            } catch {
                // If validation fails, lock the session
                lockSession()
            }
        }
    }
    
    func resetActivityTimer() {
        lastActivityTime = Date()
    }
    
    private func checkExistingSession() {
        if authService.isAuthenticated() {
            isAuthenticated = true
            biometricsEnabled = UserDefaults.standard.bool(forKey: "biometricsEnabled")
            
            // Lock session if biometrics are enabled
            if biometricsEnabled {
                isSessionLocked = true
            }
            
            // Validate token in background
            Task {
                checkSessionValidity()
            }
        }
    }
    
    private func setupSessionMonitoring() {
        sessionTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            
            Task { @MainActor in
                let timeSinceLastActivity = Date().timeIntervalSince(self.lastActivityTime)
                
                if timeSinceLastActivity > self.sessionTimeout && self.isAuthenticated && !self.isSessionLocked {
                    self.lockSession()
                }
            }
        }
    }
    
    deinit {
        sessionTimer?.invalidate()
    }
}