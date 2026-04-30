//
//  MainTabView.swift
//  DFP-NEO Mobile
//
//  Main TabView navigation - Schedule, Alerts, Unavailable, Profile
//

import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var alertsViewModel = AlertsViewModel()

    var body: some View {
        TabView {
            // Tab 1: Schedule
            ScheduleView()
                .tabItem {
                    Label("Schedule", systemImage: "calendar")
                }

            // Tab 2: Unavailability
            UnavailabilityView()
                .tabItem {
                    Label("Unavailable", systemImage: "xmark.circle")
                }

            // Tab 3: Alerts
            AlertsView()
                .badge(alertsViewModel.pendingCount > 0 ? alertsViewModel.pendingCount : 0)
                .tabItem {
                    Label("Alerts", systemImage: alertsViewModel.pendingCount > 0 ? "bell.badge.fill" : "bell.fill")
                }

            // Tab 4: Profile
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.crop.circle")
                }
        }
        .environmentObject(alertsViewModel)
        .accentColor(Color(red: 0.96, green: 0.62, blue: 0.0))
        .preferredColorScheme(.dark)
        .task {
            alertsViewModel.startPolling()
        }
        .onDisappear {
            alertsViewModel.stopPolling()
        }
    }
}