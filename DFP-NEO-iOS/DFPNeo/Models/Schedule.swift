//
//  Schedule.swift
//  DFP-NEO Mobile
//
//  Schedule and event models
//

import Foundation

struct DailySchedule: Codable, Identifiable {
    let id: String
    let date: String // YYYY-MM-DD format
    let isPublished: Bool
    let events: [ScheduleEvent]
    let serverTime: Date
    
    var displayDate: Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: date)
    }
}

struct ScheduleEvent: Codable, Identifiable {
    let id: String
    let startTime: String // HH:mm format
    let endTime: String // HH:mm format
    let eventType: EventType
    let location: String?
    let role: EventRole?
    let status: EventStatus
    let notes: String?
    let aircraft: String?
    let instructor: String?
    
    var timeRange: String {
        "\(startTime) - \(endTime)"
    }
    
    var displayLocation: String {
        location ?? "TBD"
    }
}

enum EventType: String, Codable {
    case flight = "Flight"
    case ftd = "FTD"
    case brief = "Brief"
    case duty = "Duty"
    case other = "Other"
    case ground = "Ground"
    case simulator = "Simulator"
    
    var icon: String {
        switch self {
        case .flight: return "airplane"
        case .ftd, .simulator: return "gamecontroller.fill"
        case .brief: return "doc.text.fill"
        case .duty: return "clock.fill"
        case .ground: return "book.fill"
        case .other: return "circle.fill"
        }
    }
    
    var color: String {
        switch self {
        case .flight: return "blue"
        case .ftd, .simulator: return "purple"
        case .brief: return "orange"
        case .duty: return "green"
        case .ground: return "yellow"
        case .other: return "gray"
        }
    }
}

enum EventRole: String, Codable {
    case student = "Student"
    case instructor = "Instructor"
    case crew = "Crew"
    case observer = "Observer"
    case pilot = "Pilot"
    case copilot = "Co-Pilot"
}

enum EventStatus: String, Codable {
    case published = "Published"
    case cancelled = "Cancelled"
    case amended = "Amended"
    case tentative = "Tentative"
    case confirmed = "Confirmed"
    
    var displayColor: String {
        switch self {
        case .published, .confirmed: return "green"
        case .cancelled: return "red"
        case .amended: return "orange"
        case .tentative: return "yellow"
        }
    }
}

struct ScheduleResponse: Codable {
    let schedule: DailySchedule?
    let message: String?
}

struct UnpublishedDayResponse: Codable {
    let isPublished: Bool
    let date: String
    let message: String
}