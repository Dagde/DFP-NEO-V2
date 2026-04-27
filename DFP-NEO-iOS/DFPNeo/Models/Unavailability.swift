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
    let startDateTime: String
    let endDateTime: String
    let reasonId: String
    let notes: String?
}

struct UnavailabilityResponse: Codable {
    let id: String
    let status: String          // "approved", "pending", "rejected"
    let startDateTime: String
    let endDateTime: String
    let reason: UnavailabilityReason
    let notes: String?
    let submittedAt: String
    let message: String?
}

struct QuickUnavailabilityRequest: Codable {
    let date: String
    let reasonId: String
    let notes: String?
}

struct UnavailabilityError: Codable {
    let error: String
    let message: String
    let conflicts: [String]?
}

struct ReasonsResponse: Codable {
    let reasons: [UnavailabilityReason]
}