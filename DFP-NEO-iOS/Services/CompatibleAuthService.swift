import Foundation

class AuthService {
    private let baseURL = "https://app.dfp-neo.com/api/mobile"
    
    func login(userId: String, password: String) async throws -> LoginData {
        let url = URL(string: "\(baseURL)/auth/login")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["userId": userId, "password": password]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }
        
        // Handle both success and error responses
        if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
            do {
                // Try new format first
                let loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)
                
                if let loginData = loginResponse.loginData {
                    return loginData
                } else {
                    throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "No login data in response"])
                }
            } catch {
                // Fallback: try parsing as direct LoginData (old simple format)
                do {
                    return try JSONDecoder().decode(LoginData.self, from: data)
                } catch {
                    throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to parse response: \(error.localizedDescription)"])
                }
            }
        } else {
            // Handle error responses
            let errorMessage: String
            if let errorResponse = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                errorMessage = errorResponse["error"] as? String ?? 
                             errorResponse["message"] as? String ?? 
                             "Login failed"
            } else {
                errorMessage = HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
            }
            
            throw NSError(domain: "AuthService", code: httpResponse.statusCode, userInfo: [
                NSLocalizedDescriptionKey: "Login failed (HTTP \(httpResponse.statusCode)): \(errorMessage)"
            ])
        }
    }
    
    func refreshToken(refreshToken: String) async throws -> LoginData {
        let url = URL(string: "\(baseURL)/auth/refresh")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["refreshToken": refreshToken]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }
        
        if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
            do {
                let loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)
                
                if let loginData = loginResponse.loginData {
                    return loginData
                } else {
                    throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "No login data in response"])
                }
            } catch {
                // Fallback parsing
                return try JSONDecoder().decode(LoginData.self, from: data)
            }
        } else {
            let errorMessage: String
            if let errorResponse = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                errorMessage = errorResponse["error"] as? String ?? "Refresh token failed"
            } else {
                errorMessage = HTTPURLResponse.localizedString(forStatusCode: httpResponse.statusCode)
            }
            
            throw NSError(domain: "AuthService", code: httpResponse.statusCode, userInfo: [
                NSLocalizedDescriptionKey: "Refresh failed (HTTP \(httpResponse.statusCode)): \(errorMessage)"
            ])
        }
    }
}