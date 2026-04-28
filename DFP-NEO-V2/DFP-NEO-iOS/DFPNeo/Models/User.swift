//
//  User.swift
//  DFP-NEO Mobile
//
//  NOTE: struct User is defined in Models/CompatibilityModels.swift
//  This file contains only the auth response and request models used by AuthService.
//

import Foundation

// MARK: - Auth Response
// Server returns: { success, message, data: { accessToken, refreshToken, user } }
struct AuthResponse: Codable {
    let success: Bool?
    let message: String?
    let data: AuthData?

    // Also support flat format for backwards compatibility
    let accessToken: String?
    let refreshToken: String?
    let user: User?

    var effectiveAccessToken: String {
        data?.accessToken ?? accessToken ?? ""
    }

    var effectiveRefreshToken: String {
        data?.refreshToken ?? refreshToken ?? ""
    }

    var effectiveUser: User? {
        data?.user ?? user
    }
}

struct AuthData: Codable {
    let accessToken: String
    let refreshToken: String
    let user: User
}

struct TokenRefreshResponse: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int?
}

struct LoginRequest: Codable {
    let userId: String
    let password: String
}