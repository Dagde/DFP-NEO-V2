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
                            .id(event.id)
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

#Preview {
    ScheduleView()
        .environmentObject(AuthViewModel())
}