//
//  APIService.swift
//  DFP-NEO App
//

import Foundation

enum HTTPMethod: String {
    case GET, POST, PUT, PATCH, DELETE
}

enum APIServiceError: LocalizedError {
    case invalidBaseURL
    case invalidURL
    case invalidResponse
    case httpStatus(Int, String?)
    case missingRefreshToken
    case decodingFailed
    case encodingFailed

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL: return "API base URL is invalid."
        case .invalidURL: return "Request URL is invalid."
        case .invalidResponse: return "Invalid server response."
        case .httpStatus(let code, let msg):
            return msg ?? "Server returned HTTP \(code)"
        case .missingRefreshToken: return "Missing refresh token. Please log in again."
        case .decodingFailed: return "Failed to decode server response."
        case .encodingFailed: return "Failed to encode request body."
        }
    }
}

final class APIService {
    static let shared = APIService()

    var apiBaseURLString: String {
        if let override = UserDefaults.standard.string(forKey: "dfpneo_api_base_url"),
           !override.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return override
        }

        if let configured = Bundle.main.object(forInfoDictionaryKey: "DFPNeoAPIBaseURL") as? String,
           !configured.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return configured
        }

        return ""
    }
    private let apiPrefix = "/api"

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private let defaults = UserDefaults.standard
    private let accessTokenKey = "dfpneo_access_token"
    private let refreshTokenKey = "dfpneo_refresh_token"
    private let userIdKey = "dfpneo_user_id"

    private init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
        self.encoder = JSONEncoder()
    }

    private var accessToken: String? {
        get { defaults.string(forKey: accessTokenKey) }
        set { defaults.setValue(newValue, forKey: accessTokenKey) }
    }

    private var refreshToken: String? {
        get { defaults.string(forKey: refreshTokenKey) }
        set { defaults.setValue(newValue, forKey: refreshTokenKey) }
    }

    func setTokens(access: String, refresh: String) {
        self.accessToken = access
        self.refreshToken = refresh
    }

    func setUserId(_ userId: String) {
        defaults.setValue(userId, forKey: userIdKey)
    }

    func clearTokens() {
        self.accessToken = nil
        self.refreshToken = nil
        defaults.removeObject(forKey: userIdKey)
    }

    var hasValidToken: Bool {
        guard let token = accessToken, !token.isEmpty else { return false }
        return true
    }

    var storedUserId: String? {
        defaults.string(forKey: userIdKey)
    }

    var storedAccessToken: String? {
        accessToken
    }

    // MARK: - Public request helpers

    func get<T: Decodable>(endpoint: String, authenticated: Bool = true) async throws -> T {
        return try await self.request(endpoint: endpoint, method: .GET, authenticated: authenticated)
    }

    func post<T: Decodable, Body: Encodable>(endpoint: String, body: Body, authenticated: Bool = true) async throws -> T {
        return try await self.request(endpoint: endpoint, method: .POST, body: body, authenticated: authenticated)
    }

    func put<T: Decodable, Body: Encodable>(endpoint: String, body: Body, authenticated: Bool = true) async throws -> T {
        return try await self.request(endpoint: endpoint, method: .PUT, body: body, authenticated: authenticated)
    }

    func patch<T: Decodable, Body: Encodable>(endpoint: String, body: Body, authenticated: Bool = true) async throws -> T {
        return try await self.request(endpoint: endpoint, method: .PATCH, body: body, authenticated: authenticated)
    }

    func delete<T: Decodable>(endpoint: String, authenticated: Bool = true) async throws -> T {
        return try await self.request(endpoint: endpoint, method: .DELETE, authenticated: authenticated)
    }

    // MARK: - Core request method

    private func request<T: Decodable, Body: Encodable>(
        endpoint: String,
        method: HTTPMethod,
        body: Body? = nil,
        authenticated: Bool = true,
        hasRetriedAfterRefresh: Bool = false
    ) async throws -> T {
        guard let baseURL = URL(string: apiBaseURLString),
              !apiBaseURLString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw APIServiceError.invalidBaseURL
        }

        let finalPath = fullEndpoint(endpoint)
        let cleaned = finalPath.hasPrefix("/") ? String(finalPath.dropFirst()) : finalPath

        guard let url = URL(string: cleaned, relativeTo: baseURL) else {
            throw APIServiceError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method.rawValue

        if let body = body {
            do {
                urlRequest.httpBody = try self.encoder.encode(body)
                urlRequest.addValue("application/json", forHTTPHeaderField: "Content-Type")
            } catch {
                throw APIServiceError.encodingFailed
            }
        }

        if authenticated, let token = accessToken {
            urlRequest.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        debugLogRequest(urlRequest, authenticated, token: accessToken, userId: storedUserId)

        let (data, response) = try await session.data(for: urlRequest)

        guard let http = response as? HTTPURLResponse else {
            throw APIServiceError.invalidResponse
        }

        if http.statusCode == 401, authenticated, !hasRetriedAfterRefresh {
            debugLogResponse(status: http.statusCode, url: url, data: data, note: "401 received — attempting refresh then retry")
            try await refreshAccessToken()
            return try await self.request(
                endpoint: endpoint,
                method: method,
                body: body,
                authenticated: authenticated,
                hasRetriedAfterRefresh: true
            )
        }

        guard (200...299).contains(http.statusCode) else {
            debugLogResponse(status: http.statusCode, url: url, data: data, note: "Non-2xx response")
            let msg = String(data: data, encoding: .utf8)
            throw APIServiceError.httpStatus(http.statusCode, msg)
        }

        do {
            return try self.decoder.decode(T.self, from: data)
        } catch {
            debugLogResponse(status: http.statusCode, url: url, data: data, note: "Decoding failed for \(String(describing: T.self))")
            throw APIServiceError.decodingFailed
        }
    }

    private func fullEndpoint(_ endpoint: String) -> String {
        let e = endpoint.hasPrefix("/") ? endpoint : "/" + endpoint
        let p = apiPrefix.isEmpty ? "" : (apiPrefix.hasPrefix("/") ? apiPrefix : "/" + apiPrefix)
        return p + e
    }

    // MARK: - Token refresh

    private func refreshAccessToken() async throws {
        guard let refresh = refreshToken, !refresh.isEmpty else {
            throw APIServiceError.missingRefreshToken
        }

        struct RefreshRequest: Encodable {
            let refreshToken: String
        }

        let response: TokenRefreshResponse = try await self.post(
            endpoint: "/mobile/auth/refresh",
            body: RefreshRequest(refreshToken: refresh),
            authenticated: false
        )

        self.accessToken = response.accessToken
        if let newRefresh = response.refreshToken, !newRefresh.isEmpty {
            self.refreshToken = newRefresh
        }
    }

    // MARK: - Root-relative helpers (bypass /mobile prefix, use /api directly)

    /// GET from /api{endpoint} (alerts live at /api/alerts/, not /api/mobile/alerts/)
    func getRoot<T: Decodable>(_ endpoint: String) async throws -> T {
        return try await self.get(endpoint: endpoint)
    }

    /// POST to /api{endpoint}
    func postRoot<T: Decodable, Body: Encodable>(_ endpoint: String, body: Body) async throws -> T {
        return try await self.post(endpoint: endpoint, body: body)
    }

    // MARK: - Alert API methods

    /// Fetch all alerts for a given userId
    public func getAlerts(userId: String) async throws -> AlertsListResponse {
        let encodedId = userId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? userId
        return try await self.get(endpoint: "/alerts/\(encodedId)")
    }

    /// Respond to an alert (accept or reject)
    public func respondToAlert(alertId: String, userId: String, status: String) async throws -> AlertRespondResponse {
        let requestBody = AlertRespondRequest(userId: userId, status: status)
        return try await self.post(endpoint: "/alerts/\(alertId)/respond", body: requestBody)
    }

    /// Dismiss (delete) an alert notification from the iOS app (local only)
    public func dismissAlert(alertId: String, userId: String) async throws {
        struct DismissRequest: Encodable {
            let userId: String
        }
        struct DismissResponse: Decodable {
            let success: Bool?
        }
        let _: DismissResponse = try await self.post(
            endpoint: "/alerts/\(alertId)/dismiss",
            body: DismissRequest(userId: userId)
        )
    }


    // MARK: - Debug logging

    private func debugLogRequest(_ req: URLRequest, authenticated: Bool, token: String?, userId: String?) {
        let url = req.url?.absoluteString ?? "(nil)"
        let hasToken = (token?.isEmpty == false)
        let tokenPrefix = token.map { String($0.prefix(16)) } ?? "(nil)"
        let uidValue = userId ?? "(nil)"

        print("→ [API] \(req.httpMethod ?? "?") \(url)")
        print("→ [API] authenticated=\(authenticated) tokenPresent=\(hasToken) tokenPrefix=\(tokenPrefix) userId=\(uidValue)")
    }

    private func debugLogResponse(status: Int, url: URL, data: Data, note: String) {
        let body = String(data: data, encoding: .utf8) ?? "(non-utf8 body)"
        print("← [API] HTTP \(status) \(url.absoluteString) — \(note)")
        print("← [API] Body: \(body)")
    }
}
