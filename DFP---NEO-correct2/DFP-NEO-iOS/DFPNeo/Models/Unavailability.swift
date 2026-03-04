//
//  Unavailability.swift
//  DFP-NEO Mobile
//
//  Unavailability submission models
//

import Foundation

struct UnavailabilityReason: Codable, Identifiable {
    let id: String
    let code: String
    let description: String
    let requiresApproval: Bool
}

struct UnavailabilityRequest: Codable {
    let startDateTime: String // ISO 8601 format
    let endDateTime: String // ISO 8601 format
    let reasonId: String
    let notes: String?
}

struct UnavailabilityResponse: Codable {
    let id: String
    let status: UnavailabilityStatus
    let startDateTime: String
    let endDateTime: String
    let reason: UnavailabilityReason
    let notes: String?
    let submittedAt: String
    let message: String?
}

enum UnavailabilityStatus: String, Codable {
    case pending = "Pending"
    case approved = "Approved"
    case rejected = "Rejected"
    case conflicted = "Conflicted"
    
    var displayColor: String {
        switch self {
        case .approved: return "green"
        case .rejected: return "red"
        case .pending: return "orange"
        case .conflicted: return "yellow"
        }
    }
    
    var icon: String {
        switch self {
        case .approved: return "checkmark.circle.fill"
        case .rejected: return "xmark.circle.fill"
        case .pending: return "clock.fill"
        case .conflicted: return "exclamationmark.triangle.fill"
        }
    }
}

struct QuickUnavailabilityRequest: Codable {
    let date: String // YYYY-MM-DD
    let reasonId: String
    let notes: String?
}

struct UnavailabilityError: Codable {
    let error: String
    let message: String
    let conflicts: [String]?
}