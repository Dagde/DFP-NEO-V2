// Views/MainTabView.swift

import SwiftUI

struct MainTabView: View {
    // Hoist the ViewModel here so it persists across tab switches
    // This prevents UnavailabilityView from being recreated on every tab tap
    @StateObject private var unavailabilityViewModel = UnavailabilityViewModel()

    var body: some View {
        TabView {
            ScheduleView()
                .tabItem { Label("Schedule", systemImage: "calendar") }

            UnavailabilityView(viewModel: unavailabilityViewModel)
                .tabItem { Label("Unavailable", systemImage: "xmark.circle") }

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
    }
}