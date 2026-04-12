//
//  KeychainService.swift
//  DFP-NEO Mobile
//
//  Secure token storage using iOS Keychain
//

import Foundation
import Security

class KeychainService {
    static let shared = KeychainService()
    
    private let accessTokenKey = "com.dfpneo.mobile.accessToken"
    private let refreshTokenKey = "com.dfpneo.mobile.refreshToken"
    private let userIdKey = "com.dfpneo.mobile.userId"
    
    private init() {}
    
    // MARK: - Access Token
    
    func saveAccessToken(_ token: String) throws {
        try save(token, forKey: accessTokenKey)
    }
    
    func getAccessToken() -> String? {
        return get(forKey: accessTokenKey)
    }
    
    func deleteAccessToken() throws {
        try delete(forKey: accessTokenKey)
    }
    
    // MARK: - Refresh Token
    
    func saveRefreshToken(_ token: String) throws {
        try save(token, forKey: refreshTokenKey, withBiometricProtection: true)
    }
    
    func getRefreshToken() -> String? {
        return get(forKey: refreshTokenKey)
    }
    
    func deleteRefreshToken() throws {
        try delete(forKey: refreshTokenKey)
    }
    
    // MARK: - User ID
    
    func saveUserId(_ userId: String) throws {
        try save(userId, forKey: userIdKey)
    }
    
    func getUserId() -> String? {
        return get(forKey: userIdKey)
    }
    
    func deleteUserId() throws {
        try delete(forKey: userIdKey)
    }
    
    // MARK: - Clear All
    
    func clearAll() throws {
        try deleteAccessToken()
        try deleteRefreshToken()
        try deleteUserId()
    }
    
    // MARK: - Private Helpers
    
    private func save(_ value: String, forKey key: String, withBiometricProtection: Bool = false) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.encodingError
        }
        
        // Delete existing item first
        try? delete(forKey: key)
        
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        if withBiometricProtection {
            // Add biometric protection for refresh token
            let access = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                .biometryCurrentSet,
                nil
            )
            query[kSecAttrAccessControl as String] = access
        }
        
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }
    
    private func get(forKey key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return value
    }
    
    private func delete(forKey key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
    }
}

enum KeychainError: Error, LocalizedError {
    case encodingError
    case saveFailed(OSStatus)
    case deleteFailed(OSStatus)
    
    var errorDescription: String? {
        switch self {
        case .encodingError:
            return "Failed to encode data for keychain storage"
        case .saveFailed(let status):
            return "Failed to save to keychain (status: \(status))"
        case .deleteFailed(let status):
            return "Failed to delete from keychain (status: \(status))"
        }
    }
}