//
//  ScheduleView.swift
//  DFP-NEO Mobile
//
//  Main schedule display with swipe navigation
//

import SwiftUI

struct ScheduleView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = ScheduleViewModel()
    @State private var showingUnavailability = false
    @State private var dragOffset: CGFloat = 0
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.black.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Header
                    headerView
                    
                    // Schedule content
                    if viewModel.isLoading && viewModel.currentSchedule == nil {
                        loadingView
                    } else if let schedule = viewModel.currentSchedule {
                        scheduleContentView(schedule: schedule)
                    } else {
                        unpublishedView
                    }
                }
            }
            .navigationBarHidden(true)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        dragOffset = value.translation.width
                    }
                    .onEnded { value in
                        handleSwipe(value.translation.width)
                        dragOffset = 0
                    }
            )
            .sheet(isPresented: $showingUnavailability) {
                UnavailabilityView()
            }
            .task {
                await viewModel.loadSchedule()
            }
        }
    }
    
    // MARK: - Header
    
    private var headerView: some View {
        VStack(spacing: 12) {
            HStack {
                // User info
                VStack(alignment: .leading, spacing: 4) {
                    Text(authViewModel.currentUser?.effectiveDisplayName ?? "User")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Text(authViewModel.currentUser?.userId ?? "")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.6))
                }
                
                Spacer()
                
                // Unavailability button
                Button(action: { showingUnavailability = true }) {
                    HStack(spacing: 6) {
                        Image(systemName: "calendar.badge.exclamationmark")
                        Text("Unavailable")
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.black)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.white)
                    .cornerRadius(8)
                }
                
                // Logout button
                Button(action: { authViewModel.logout() }) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.title3)
                        .foregroundColor(.white.opacity(0.8))
                }
                .padding(.leading, 8)
            }
            .padding(.horizontal)
            .padding(.top, 16)
            
            // Date navigation
            HStack {
                Button(action: { Task { await viewModel.goToPreviousDay() } }) {
                    Image(systemName: "chevron.left")
                        .font(.title3)
                        .foregroundColor(viewModel.canGoBack ? .white : .white.opacity(0.3))
                }
                .disabled(!viewModel.canGoBack)
                
                Spacer()
                
                VStack(spacing: 4) {
                    Text(viewModel.displayDate)
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    if !viewModel.isToday {
                        Button(action: { Task { await viewModel.goToToday() } }) {
                            Text("Today")
                                .font(.caption)
                                .foregroundColor(.blue)
                        }
                    }
                }
                
                Spacer()
                
                Button(action: { Task { await viewModel.goToNextDay() } }) {
                    Image(systemName: "chevron.right")
                        .font(.title3)
                        .foregroundColor(.white)
                }
            }
            .padding(.horizontal)
            
            // Status bar
            HStack {
                if viewModel.isOffline {
                    Label("Offline", systemImage: "wifi.slash")
                        .font(.caption)
                        .foregroundColor(.orange)
                } else if let lastUpdated = viewModel.lastUpdated {
                    Text(viewModel.displayTime)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                }
                
                Spacer()
                
                if viewModel.isRefreshing {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
        .background(Color.black)
    }
    
    // MARK: - Schedule Content
    
    private func scheduleContentView(schedule: DailySchedule) -> some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if schedule.events.isEmpty {
                    emptyScheduleView
                } else {
                    ForEach(schedule.events) { event in
                        EventCardView(event: event)
                    }
                }
            }
            .padding()
        }
        .refreshable {
            await viewModel.refreshSchedule()
        }
    }
    
    // MARK: - Empty/Loading States
    
    private var loadingView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                .scaleEffect(1.5)
            
            Text("Loading schedule...")
                .foregroundColor(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var unpublishedView: some View {
        VStack(spacing: 20) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 60))
                .foregroundColor(.white.opacity(0.5))
            
            Text("Not Yet Published")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text(viewModel.errorMessage ?? "This schedule has not been published in DFP-NEO")
                .font(.body)
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var emptyScheduleView: some View {
        VStack(spacing: 20) {
            Image(systemName: "calendar")
                .font(.system(size: 60))
                .foregroundColor(.white.opacity(0.5))
            
            Text("No Events Scheduled")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text("You have no scheduled events for this day")
                .font(.body)
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
    
    // MARK: - Swipe Handling
    
    private func handleSwipe(_ width: CGFloat) {
        let threshold: CGFloat = 50
        
        if width > threshold && viewModel.canGoBack {
            Task {
                await viewModel.goToPreviousDay()
            }
        } else if width < -threshold {
            Task {
                await viewModel.goToNextDay()
            }
        }
    }
}

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

#Preview {
    ScheduleView()
        .environmentObject(AuthViewModel())
}