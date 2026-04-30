//
//  Unavailability.swift
//  DFP-NEO Mobile
//
//  Unavailability submission models with custom encoding to bypass snake_case
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
    
    // Custom encoding to bypass global snake_case encoder
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: RawCodingKey.self)
        try container.encode(startDateTime, forKey: RawCodingKey("startDateTime"))
        try container.encode(endDateTime, forKey: RawCodingKey("endDateTime"))
        try container.encode(reasonId, forKey: RawCodingKey("reasonId"))
        try container.encodeIfPresent(notes, forKey: RawCodingKey("notes"))
    }
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
    
    // Custom encoding to bypass global snake_case encoder
    // This ensures reasonId is sent as "reasonId" not "reason_id"
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: RawCodingKey.self)
        try container.encode(date, forKey: RawCodingKey("date"))
        try container.encode(reasonId, forKey: RawCodingKey("reasonId"))
        try container.encodeIfPresent(notes, forKey: RawCodingKey("notes"))
    }
}

struct UnavailabilityError: Codable {
    let error: String
    let message: String
    let conflicts: [String]?
}

struct ReasonsResponse: Codable {
    let reasons: [UnavailabilityReason]
}

// RawCodingKey struct to bypass global encoder strategies
struct RawCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int?
    
    init(stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }
    
    init(intValue: Int) {
        self.stringValue = String(intValue)
        self.intValue = intValue
    }
}