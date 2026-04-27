//
//  AuthService.swift
//  DFP-NEO Mobile
//
//  Authentication service - handles login, token refresh, and session management
//

import Foundation

class AuthService {
    static let shared = AuthService()
    
    private let api = APIService.shared
    private let keychain = KeychainService.shared
    
    private init() {}
    
    // MARK: - Authentication
    
    func login(userId: String, password: String) async throws -> AuthResponse {
        let request = LoginRequest(userId: userId, password: password)
        
        let response: AuthResponse = try await api.post(
            endpoint: "/mobile/auth/login",
            body: request,
            requiresAuth: false
        )
        
        // Store tokens securely
        try keychain.saveAccessToken(response.accessToken)
        try keychain.saveRefreshToken(response.refreshToken)
        try keychain.saveUserId(response.user.userId)
        
        return response
    }
    
    func refreshToken() async throws -> TokenRefreshResponse {
        guard let refreshToken = keychain.getRefreshToken() else {
            throw AuthError.noRefreshToken
        }
        
        let request = ["refreshToken": refreshToken]
        
        let response: TokenRefreshResponse = try await api.post(
            endpoint: "/mobile/auth/refresh",
            body: request,
            requiresAuth: false
        )
        
        // Update access token
        try keychain.saveAccessToken(response.accessToken)
        
        return response
    }
    
    func logout() async throws {
        // Call logout endpoint if needed
        do {
            let _: EmptyResponse = try await api.post(
                endpoint: "/mobile/auth/logout",
                body: EmptyRequest(),
                requiresAuth: true
            )
        } catch {
            // Continue with local logout even if server call fails
            print("Server logout failed: \(error)")
        }
        
        // Clear all stored credentials
        try keychain.clearAll()
    }
    
    // MARK: - Session Management
    
    func isAuthenticated() -> Bool {
        return keychain.getAccessToken() != nil
    }
    
    func getCurrentUserId() -> String? {
        return keychain.getUserId()
    }
    
    // MARK: - Token Validation
    
    func validateToken() async throws -> Bool {
        do {
            // Try to fetch user profile to validate token
            let _: User = try await api.get(endpoint: "/mobile/auth/me")
            return true
        } catch APIError.unauthorized {
            // Token expired, try to refresh
            do {
                _ = try await refreshToken()
                return true
            } catch {
                return false
            }
        } catch {
            throw error
        }
    }
}

// MARK: - Supporting Types

struct EmptyRequest: Codable {}
struct EmptyResponse: Codable {}

enum AuthError: Error, LocalizedError {
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