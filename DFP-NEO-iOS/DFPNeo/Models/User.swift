//
//  User.swift
//  DFP-NEO Mobile
//
//  User authentication and profile models
//

import Foundation

struct User: Codable, Identifiable {
    let id: String
    let userId: String
    let displayName: String?
    let email: String?
    let status: UserStatus
    let permissionsRole: PermissionsRole
    let mustChangePassword: Bool
    
    var effectiveDisplayName: String {
        displayName ?? userId
    }
}

struct PermissionsRole: Codable {
    let id: String
    let name: String
}

enum UserStatus: String, Codable {
    case active
    case inactive
    case pending
    case suspended
}

struct AuthResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let user: User
    let expiresIn: Int // seconds
}

struct TokenRefreshResponse: Codable {
    let accessToken: String
    let expiresIn: Int
}

struct LoginRequest: Codable {
    let userId: String
    let password: String
}

struct AuthError: Codable {
    let error: String
    let message: String?
}