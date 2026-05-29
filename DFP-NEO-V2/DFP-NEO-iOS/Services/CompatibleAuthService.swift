import Foundation

class AuthService {
    private var baseURL: String {
        let configured = APIService.shared.apiBaseURLString.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = configured.hasSuffix("/") ? String(configured.dropLast()) : configured
        return "\(normalized)/api/mobile"
    }

    private func mobileURL(_ path: String) throws -> URL {
        guard !APIService.shared.apiBaseURLString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let url = URL(string: "\(baseURL)\(path)") else {
            throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "API base URL is not configured"])
        }
        return url
    }
    
    func login(userId: String, password: String) async throws -> LoginData {
        let url = try mobileURL("/auth/login")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["userId": userId, "password": password]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }
        
        if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
            do {
                // Try new format first: { success, message, data: { accessToken, refreshToken, user } }
                let loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)
                
                if let loginData = loginResponse.loginData {
                    // ✅ CRITICAL: Store tokens in APIService so ScheduleViewModel & UnavailabilityViewModel work
                    APIService.shared.setTokens(access: loginData.accessToken, refresh: loginData.refreshToken)
                    APIService.shared.setUserId(loginData.user.userId)
                    print("✅ [AuthService] Tokens stored in APIService after login")
                    print("   - userId: \(loginData.user.userId)")
                    print("   - accessToken prefix: \(String(loginData.accessToken.prefix(20)))")
                    return loginData
                } else {
                    throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "No login data in response"])
                }
            } catch {
                // Fallback: try parsing as direct LoginData (old simple format)
                do {
                    let loginData = try JSONDecoder().decode(LoginData.self, from: data)
                    // ✅ CRITICAL: Store tokens in APIService
                    APIService.shared.setTokens(access: loginData.accessToken, refresh: loginData.refreshToken)
                    APIService.shared.setUserId(loginData.user.userId)
                    print("✅ [AuthService] Tokens stored in APIService (fallback format)")
                    return loginData
                } catch {
                    let rawBody = String(data: data, encoding: .utf8) ?? "(unreadable)"
                    print("❌ [AuthService] Failed to parse login response: \(error)")
                    print("❌ [AuthService] Raw response: \(rawBody)")
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
        let url = try mobileURL("/auth/refresh")
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
                    // ✅ Update tokens in APIService
                    APIService.shared.setTokens(access: loginData.accessToken, refresh: loginData.refreshToken)
                    return loginData
                } else {
                    throw NSError(domain: "AuthService", code: -1, userInfo: [NSLocalizedDescriptionKey: "No login data in response"])
                }
            } catch {
                // Fallback parsing
                let loginData = try JSONDecoder().decode(LoginData.self, from: data)
                APIService.shared.setTokens(access: loginData.accessToken, refresh: loginData.refreshToken)
                return loginData
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
