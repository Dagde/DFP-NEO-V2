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
            authenticated: false
        )

        let accessToken = response.effectiveAccessToken
        let refreshToken = response.effectiveRefreshToken

        guard !accessToken.isEmpty else {
            throw AuthServiceError.invalidCredentials
        }

        // Store tokens in APIService (UserDefaults) and Keychain
        api.setTokens(access: accessToken, refresh: refreshToken)
        api.setUserId(userId)
        try? keychain.saveAccessToken(accessToken)
        try? keychain.saveRefreshToken(refreshToken)
        try? keychain.saveUserId(userId)

        return response
    }

    func refreshToken() async throws -> TokenRefreshResponse {
        guard let storedRefresh = keychain.getRefreshToken() else {
            throw AuthServiceError.noRefreshToken
        }

        struct RefreshRequest: Codable {
            let refreshToken: String
        }

        let response: TokenRefreshResponse = try await api.post(
            endpoint: "/mobile/auth/refresh",
            body: RefreshRequest(refreshToken: storedRefresh),
            authenticated: false
        )

        // Update stored tokens
        api.setTokens(access: response.accessToken, refresh: response.refreshToken ?? storedRefresh)
        try? keychain.saveAccessToken(response.accessToken)
        if let newRefresh = response.refreshToken {
            try? keychain.saveRefreshToken(newRefresh)
        }

        return response
    }

    func logout() async throws {
        do {
            let _: EmptyResponse = try await api.post(
                endpoint: "/mobile/auth/logout",
                body: EmptyRequest(),
                authenticated: true
            )
        } catch {
            print("Server logout failed: \(error)")
        }

        api.clearTokens()
        try? keychain.clearAll()
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
            let _: User = try await api.get(endpoint: "/mobile/auth/me")
            return true
        } catch APIServiceError.httpStatus(401, _) {
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