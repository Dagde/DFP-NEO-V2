import Foundation

// MARK: - Backward Compatible Response Models

// Handles both old and new API response formats
struct LoginResponse: Codable {
    let success: Bool?
    let message: String?
    let error: String?
    
    // New format - nested data
    let data: LoginData?
    
    // Old format - direct fields (for backward compatibility)
    let accessToken: String?
    let refreshToken: String?
    let user: User?
    
    // Computed property to extract login data from either format
    var loginData: LoginData? {
        if let data = data {
            return data // New format
        } else if let accessToken = accessToken, let user = user {
            return LoginData(accessToken: accessToken, refreshToken: refreshToken ?? "", user: user) // Old format
        }
        return nil
    }
    
    // Helper to extract error message
    var errorMessage: String? {
        return error ?? message
    }
}

struct LoginData: Codable {
    let accessToken: String
    let refreshToken: String
    let user: User
}

// Enhanced User model with flexible decoding
// Server sends camelCase: id, userId, displayName, email, role, isActive, firstName, lastName
struct User: Codable, Identifiable, Equatable {
    let id: String
    let userId: String
    let displayName: String
    let email: String
    let role: PermissionsRole
    let isActive: Bool?
    let firstName: String?
    let lastName: String?
    
    // CodingKeys match server's camelCase JSON fields
    private enum CodingKeys: String, CodingKey {
        case id
        case userId          // server sends "userId" (camelCase)
        case displayName     // server sends "displayName" (camelCase)
        case email
        case role
        case isActive
        case firstName
        case lastName
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // Required fields
        self.id = try container.decode(String.self, forKey: .id)
        
        // userId: try camelCase "userId" first, fall back to id
        if let uid = try? container.decode(String.self, forKey: .userId) {
            self.userId = uid
        } else {
            self.userId = try container.decode(String.self, forKey: .id)
        }
        
        self.email = try container.decode(String.self, forKey: .email)
        
        // Handle displayName - try "displayName" first, then construct from firstName/lastName
        if let displayName = try? container.decode(String.self, forKey: .displayName), !displayName.isEmpty {
            self.displayName = displayName
        } else {
            let firstName = try? container.decode(String.self, forKey: .firstName)
            let lastName  = try? container.decode(String.self, forKey: .lastName)
            if let first = firstName, let last = lastName {
                self.displayName = "\(first) \(last)"
            } else if let first = firstName {
                self.displayName = first
            } else {
                self.displayName = self.userId
            }
        }
        
        // Handle role - decode as String then convert to enum
        let roleString = (try? container.decode(String.self, forKey: .role)) ?? "OTHER"
        self.role = PermissionsRole(rawValue: roleString.uppercased()) ?? .other
        
        // Optional fields
        self.isActive  = try? container.decodeIfPresent(Bool.self, forKey: .isActive)
        self.firstName = try? container.decodeIfPresent(String.self, forKey: .firstName)
        self.lastName  = try? container.decodeIfPresent(String.self, forKey: .lastName)
    }
    
    // Computed property for display (matches old User model API used by ScheduleView)
    var effectiveDisplayName: String {
        displayName.isEmpty ? userId : displayName
    }

    init(id: String, userId: String, displayName: String, email: String,
         role: PermissionsRole, isActive: Bool? = nil,
         firstName: String? = nil, lastName: String? = nil) {
        self.id          = id
        self.userId      = userId
        self.displayName = displayName
        self.email       = email
        self.role        = role
        self.isActive    = isActive
        self.firstName   = firstName
        self.lastName    = lastName
    }
}

// MARK: - Permissions Enum
enum PermissionsRole: String, Codable {
    case admin      = "ADMIN"
    case instructor = "INSTRUCTOR"
    case student    = "STUDENT"
    case other      = "OTHER"
}