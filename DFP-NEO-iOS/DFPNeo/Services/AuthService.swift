//
//  AuthService.swift
//  DFP-NEO Mobile
//
//  NOTE: class AuthService is defined in Services/CompatibleAuthService.swift
//  This file is intentionally empty to avoid redeclaration conflicts.
//

import Foundation

// MARK: - Supporting Types (used across the app)

struct EmptyRequest: Codable {}
struct EmptyResponse: Codable {}

enum AuthServiceError: Error, LocalizedError {
    case noRefreshToken
    case invalidCredentials
    case sessionExpired

    var errorDescription: String? {
        switch self {
        case .noRefreshToken:
            return "No refresh token available"
        case .invalidCredentials:
            return "Invalid user ID or password"
        case .sessionExpired:
            return "Your session has expired. Please log in again."
        }
    }
}