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

    private let baseURLString = "https://app.dfp-neo.com"  // ✅ CORRECTED: Changed from "https://dfp-neo.com"
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
    }

    // MARK: - Public request helpers

    func get<T: Decodable>(endpoint: String, authenticated: Bool = true) async throws -> T {
        try await request(endpoint: endpoint, method: .GET, body: nil, authenticated: authenticated)
    }

    func post<T: Decodable, B: Encodable>(endpoint: String, body: B, authenticated: Bool = true) async throws -> T {
        do {
            let data = try encoder.encode(body)
            return try await request(endpoint: endpoint, method: .POST, body: data, authenticated: authenticated)
        } catch {
            throw APIServiceError.encodingFailed
        }
    }

    // MARK: - Core request (401 refresh retry)

    private func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod,
        body: Data?,
        authenticated: Bool,
        hasRetriedAfterRefresh: Bool = false
    ) async throws -> T {

        guard let baseURL = URL(string: baseURLString) else {
            throw APIServiceError.invalidBaseURL
        }

        let finalPath = fullEndpoint(endpoint)
        let cleaned = finalPath.hasPrefix("/") ? String(finalPath.dropFirst()) : finalPath

        guard let url = URL(string: cleaned, relativeTo: baseURL) else {
            throw APIServiceError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method.rawValue
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body = body {
            urlRequest.httpBody = body
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let token = accessToken
        let uid = defaults.string(forKey: userIdKey)

        if authenticated, let token, !token.isEmpty {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            urlRequest.setValue(token, forHTTPHeaderField: "x-access-token")
            urlRequest.setValue(token, forHTTPHeaderField: "X-Authorization")
        }

        if let uid, !uid.isEmpty {
            urlRequest.setValue(uid, forHTTPHeaderField: "X-DFP-UserId")
        }

        debugLogRequest(urlRequest, authenticated: authenticated, token: token, userId: uid)

        let (data, response) = try await session.data(for: urlRequest)

        guard let http = response as? HTTPURLResponse else {
            throw APIServiceError.invalidResponse
        }

        if http.statusCode == 401, authenticated, !hasRetriedAfterRefresh {
            debugLogResponse(status: http.statusCode, url: url, data: data, note: "401 received — attempting refresh then retry")
            try await refreshAccessToken()
            return try await request(
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
            return try decoder.decode(T.self, from: data)
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

        let response: TokenRefreshResponse = try await post(
            endpoint: "/mobile/auth/refresh",
            body: RefreshRequest(refreshToken: refresh),
            authenticated: false
        )

        self.accessToken = response.accessToken
        if let newRefresh = response.refreshToken, !newRefresh.isEmpty {
            self.refreshToken = newRefresh
        }
    }

    // MARK: - Debug logging

    private func debugLogRequest(_ req: URLRequest, authenticated: Bool, token: String?, userId: String?) {
        let url = req.url?.absoluteString ?? "(nil)"
        let hasToken = (token?.isEmpty == false)
        let tokenPrefix = token.map { String($0.prefix(16)) } ?? "(nil)"
        let uidValue = userId ?? "(nil)"

        print("➡️ [API] \(req.httpMethod ?? "?") \(url)")
        print("➡️ [API] authenticated=\(authenticated) tokenPresent=\(hasToken) tokenPrefix=\(tokenPrefix) userId=\(uidValue)")
    }

    private func debugLogResponse(status: Int, url: URL, data: Data, note: String) {
        let body = String(data: data, encoding: .utf8) ?? "(non-utf8 body)"
        print("⬅️ [API] HTTP \(status) \(url.absoluteString) — \(note)")
        print("⬅️ [API] Body: \(body)")
    }
}