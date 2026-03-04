//
//  BiometricService.swift
//  DFP-NEO Mobile
//
//  Face ID / Touch ID authentication service
//

import Foundation
import LocalAuthentication

class BiometricService {
    static let shared = BiometricService()
    
    private init() {}
    
    enum BiometricType {
        case faceID
        case touchID
        case none
    }
    
    var biometricType: BiometricType {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        
        switch context.biometryType {
        case .faceID:
            return .faceID
        case .touchID:
            return .touchID
        default:
            return .none
        }
    }
    
    var isBiometricAvailable: Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }
    
    func authenticate(reason: String) async throws -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"
        
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw BiometricError.notAvailable
        }
        
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            return success
        } catch let error as LAError {
            throw BiometricError.authenticationFailed(error)
        }
    }
    
    func authenticateWithFallback(reason: String) async throws -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"
        context.localizedFallbackTitle = "Use Passcode"
        
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication, // Allows passcode fallback
                localizedReason: reason
            )
            return success
        } catch let error as LAError {
            throw BiometricError.authenticationFailed(error)
        }
    }
}

enum BiometricError: Error, LocalizedError {
    case notAvailable
    case authenticationFailed(LAError)
    case cancelled
    
    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Biometric authentication is not available on this device"
        case .authenticationFailed(let error):
            switch error.code {
            case .userCancel:
                return "Authentication was cancelled"
            case .userFallback:
                return "User chose to use passcode"
            case .biometryNotAvailable:
                return "Biometric authentication is not available"
            case .biometryNotEnrolled:
                return "No biometric data is enrolled"
            case .biometryLockout:
                return "Biometric authentication is locked. Please use passcode."
            default:
                return "Authentication failed: \(error.localizedDescription)"
            }
        case .cancelled:
            return "Authentication was cancelled"
        }
    }
}