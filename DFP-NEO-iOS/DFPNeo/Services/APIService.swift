//
//  APIService.swift
//  DFP-NEO Mobile
//
//  Core API communication service
//

import Foundation

class APIService {
    static let shared = APIService()
    
    // MARK: - Configuration
    private let baseURL = "https://dfp-neo.com/api"
    private let timeout: TimeInterval = 30
    
    private init() {}
    
    // MARK: - Request Methods
    
    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        body: Encodable? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add authentication token if required
        if requiresAuth {
            guard let token = KeychainService.shared.getAccessToken() else {
                throw APIError.unauthorized
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Add request body if provided
        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }
        
        // Perform request
        let (data, response) = try await URLSession.shared.data(for: request)
        
        // Validate response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        // Handle different status codes
        switch httpResponse.statusCode {
        case 200...299:
            // Success - decode response
            do {
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
            
        case 401:
            throw APIError.unauthorized
            
        case 403:
            throw APIError.forbidden
            
        case 404:
            throw APIError.notFound
            
        case 400...499:
            // Client error - try to decode error message
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.clientError(errorResponse.message ?? "Request failed")
            }
            throw APIError.clientError("Request failed with status \(httpResponse.statusCode)")
            
        case 500...599:
            throw APIError.serverError
            
        default:
            throw APIError.unknown
        }
    }
    
    // MARK: - Convenience Methods
    
    func get<T: Decodable>(endpoint: String, requiresAuth: Bool = true) async throws -> T {
        return try await request(endpoint: endpoint, method: .get, requiresAuth: requiresAuth)
    }
    
    func post<T: Decodable>(endpoint: String, body: Encodable, requiresAuth: Bool = true) async throws -> T {
        return try await request(endpoint: endpoint, method: .post, body: body, requiresAuth: requiresAuth)
    }
    
    func put<T: Decodable>(endpoint: String, body: Encodable, requiresAuth: Bool = true) async throws -> T {
        return try await request(endpoint: endpoint, method: .put, body: body, requiresAuth: requiresAuth)
    }
    
    func delete<T: Decodable>(endpoint: String, requiresAuth: Bool = true) async throws -> T {
        return try await request(endpoint: endpoint, method: .delete, requiresAuth: requiresAuth)
    }
}

// MARK: - Supporting Types

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case delete = "DELETE"
    case patch = "PATCH"
}

struct ErrorResponse: Codable {
    let error: String?
    let message: String?
}

enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case clientError(String)
    case serverError
    case decodingError(Error)
    case networkError(Error)
    case unknown
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Unauthorized - please log in again"
        case .forbidden:
            return "Access forbidden"
        case .notFound:
            return "Resource not found"
        case .clientError(let message):
            return message
        case .serverError:
            return "Server error - please try again later"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .unknown:
            return "An unknown error occurred"
        }
    }
}