//
//  Alert.swift
//  DFP-NEO Mobile
//
//  Alert model for schedule change notifications
//

import Foundation

// MARK: - Alert Response (matches server GET /api/alerts/:userId format)

struct AlertResponse: Codable, Identifiable {
    let alertId: String
    let eventId: String
    let date: String
    let sentAt: String
    let sentBy: String
    let recipients: [String]
    let eventDetails: AlertEventDetails
    let myStatus: String      // "pending" | "accepted" | "rejected"
    let respondedAt: String?

    // Identifiable conformance
    var id: String { alertId + eventId }

    var myStatusEnum: AlertRecipientStatus {
        return AlertRecipientStatus(rawValue: myStatus) ?? .pending
    }

    var isPending: Bool {
        return myStatusEnum == .pending
    }

    var sentAtDate: Date? {
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: sentAt)
    }

    // Check if current user is a recipient (always true from this endpoint since we filter by userId)
    var isForMe: Bool { true }
}

struct AlertEventDetails: Codable {
    let flightNumber: String?
    let startTime: Double?
    let duration: Double?
    let resourceId: String?
    let instructor: String?
    let student: String?
    let pilot: String?

    var formattedStartTime: String {
        guard let t = startTime else { return "--:--" }
        let hours = Int(t)
        let minutes = Int((t - Double(hours)) * 60)
        return String(format: "%02d:%02d", hours, minutes)
    }

    var formattedEndTime: String {
        guard let start = startTime, let dur = duration else { return "--:--" }
        let end = start + dur
        let hours = Int(end)
        let minutes = Int((end - Double(hours)) * 60)
        return String(format: "%02d:%02d", hours, minutes)
    }

    var displayName: String {
        return flightNumber ?? "Unknown Event"
    }

    var crewDisplay: String {
        var parts: [String] = []
        if let inst = instructor, !inst.isEmpty { parts.append(inst) }
        if let stu = student, !stu.isEmpty { parts.append(stu) }
        if let p = pilot, !p.isEmpty { parts.append(p) }
        return parts.joined(separator: " / ")
    }
}

enum AlertRecipientStatus: String, Codable {
    case pending = "pending"
    case accepted = "accepted"
    case rejected = "rejected"

    var displayText: String {
        switch self {
        case .pending: return "PENDING"
        case .accepted: return "ACCEPTED"
        case .rejected: return "REJECTED"
        }
    }
}

// MARK: - API Request/Response types

struct AlertRespondRequest: Encodable {
    let userId: String
    let status: String
}

struct AlertsListResponse: Decodable {
    let alerts: [AlertResponse]
}

struct AlertRespondResponse: Decodable {
    let success: Bool
    let alertId: String?
    let userId: String?
    let status: String?
    let message: String?
}