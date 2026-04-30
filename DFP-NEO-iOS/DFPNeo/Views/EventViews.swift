//
//  EventViews.swift
//  DFP-NEO Mobile
//
//  Event card and status badge views
//

import SwiftUI

// MARK: - Event Card

struct EventCardView: View {
    let event: ScheduleEvent
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: event.eventType.icon)
                    .foregroundColor(colorForType(event.eventType.color))
                
                Text(event.eventType.rawValue)
                    .font(.headline)
                    .foregroundColor(.white)
                
                Spacer()
                
                StatusBadge(status: event.status)
            }
            
            // Time
            HStack {
                Image(systemName: "clock")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.6))
                
                Text(event.timeRange)
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.9))
            }
            
            // Location
            HStack {
                Image(systemName: "location")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.6))
                
                Text(event.displayLocation)
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.9))
            }
            
            // Role
            if let role = event.role {
                HStack {
                    Image(systemName: "person")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.6))
                    
                    Text(role.rawValue)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.9))
                }
            }
            
            // Aircraft
            if let aircraft = event.aircraft {
                HStack {
                    Image(systemName: "airplane")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.6))
                    
                    Text(aircraft)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.9))
                }
            }
            
            // Instructor
            if let instructor = event.instructor {
                HStack {
                    Image(systemName: "person.fill")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.6))
                    
                    Text("Instructor: \(instructor)")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.9))
                }
            }
            
            // Notes
            if let notes = event.notes, !notes.isEmpty {
                Divider()
                    .background(Color.white.opacity(0.2))
                
                Text(notes)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding()
        .background(Color.white.opacity(0.1))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.2), lineWidth: 1)
        )
    }
    
    private func colorForType(_ colorName: String) -> Color {
        switch colorName {
        case "blue": return .blue
        case "purple": return .purple
        case "orange": return .orange
        case "green": return .green
        case "yellow": return .yellow
        default: return .gray
        }
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: EventStatus
    
    var body: some View {
        Text(status.rawValue)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundColor(colorForStatus(status.displayColor))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(colorForStatus(status.displayColor).opacity(0.2))
            .cornerRadius(6)
    }
    
    private func colorForStatus(_ colorName: String) -> Color {
        switch colorName {
        case "green": return .green
        case "red": return .red
        case "orange": return .orange
        case "yellow": return .yellow
        default: return .gray
        }
    }
}