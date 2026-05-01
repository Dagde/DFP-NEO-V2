//
//  AlertsView.swift
//  DFP-NEO Mobile
//
//  Displays schedule change alerts for pilots to ACCEPT or REJECT
//

import SwiftUI

struct AlertsView: View {
    @EnvironmentObject var viewModel: AlertsViewModel
    @State private var alertToDelete: AlertResponse? = nil
    @State private var showDeleteConfirm: Bool = false

    var body: some View {
        NavigationView {
            ZStack {
                Color.black.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header
                    headerView

                    // Content
                    if viewModel.isLoading {
                        loadingView
                    } else if viewModel.alerts.isEmpty {
                        emptyView
                    } else {
                        alertListView
                    }
                }
            }
            .navigationBarHidden(true)
        }
        .task {
            await viewModel.loadAlerts()
        }
        .alert("Delete Alert", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                if let alert = alertToDelete {
                    Task { await viewModel.dismiss(alert: alert) }
                    alertToDelete = nil
                }
            }
            Button("Cancel", role: .cancel) {
                alertToDelete = nil
            }
        } message: {
            Text("This alert will be removed from your list.")
        }
    }

    // MARK: - Header

    private var headerView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Alerts")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.white)

                if viewModel.pendingCount > 0 {
                    Text("\(viewModel.pendingCount) pending response\(viewModel.pendingCount == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundColor(Color(red: 0.96, green: 0.62, blue: 0.0))
                } else {
                    Text("No pending responses")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                }
            }

            Spacer()

            // Refresh button
            Button(action: {
                Task { await viewModel.loadAlerts() }
            }) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 18))
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(Color(white: 0.08))
    }

    // MARK: - Alert List

    private var alertListView: some View {
        List {
            ForEach(viewModel.alerts) { alert in
                AlertCardView(alert: alert, viewModel: viewModel)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            alertToDelete = alert
                            showDeleteConfirm = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }
        }
        .listStyle(.plain)
        .background(Color.black)
        .scrollContentBackground(.hidden)
    }

    // MARK: - Loading

    private var loadingView: some View {
        VStack(spacing: 16) {
            Spacer()
            ProgressView()
                .tint(.white)
                .scaleEffect(1.5)
            Text("Loading alerts...")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.6))
            Spacer()
        }
    }

    // MARK: - Empty

    private var emptyView: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "bell.slash")
                .font(.system(size: 60))
                .foregroundColor(.white.opacity(0.3))
            Text("No Alerts")
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundColor(.white.opacity(0.5))
            Text("Schedule change notifications\nwill appear here")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.35))
                .multilineTextAlignment(.center)
            Spacer()
        }
    }
}

// MARK: - Alert Card

struct AlertCardView: View {
    let alert: AlertResponse
    @ObservedObject var viewModel: AlertsViewModel
    @State private var isResponding: Bool = false

    private var status: AlertRecipientStatus {
        return alert.myStatusEnum
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Top status bar
            statusBar

            VStack(alignment: .leading, spacing: 12) {
                // Event info
                eventInfoSection

                // Divider
                Rectangle()
                    .fill(Color.white.opacity(0.08))
                    .frame(height: 1)

                // Sent info
                sentInfoSection

                // Response buttons (only if pending)
                if alert.isPending {
                    responseButtons
                }
            }
            .padding(16)
        }
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(white: 0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(borderColor, lineWidth: 1.5)
                )
        )
        .opacity(isResponding ? 0.6 : 1.0)
    }

    // MARK: - Status Bar

    private var statusBar: some View {
        HStack {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(alert.isPending ? "ACTION REQUIRED" : status.displayText)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(statusColor)
            Spacer()
            Text(formattedDate)
                .font(.system(size: 10))
                .foregroundColor(.white.opacity(0.4))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(statusColor.opacity(0.12))
        .clipShape(
            UnevenRoundedRectangle(
                topLeadingRadius: 12,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: 12
            )
        )
    }

    // MARK: - Event Info

    private var eventInfoSection: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(alert.eventDetails.displayName)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(.white)

                if !alert.eventDetails.crewDisplay.isEmpty {
                    Text(alert.eventDetails.crewDisplay)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(alert.eventDetails.formattedStartTime)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                Text("→ \(alert.eventDetails.formattedEndTime)")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.6))
            }
        }
    }

    // MARK: - Sent Info

    private var sentInfoSection: some View {
        HStack(spacing: 4) {
            Image(systemName: "person.fill")
                .font(.system(size: 11))
                .foregroundColor(.white.opacity(0.4))
            Text("Sent by \(alert.sentBy)")
                .font(.caption)
                .foregroundColor(.white.opacity(0.4))
            Spacer()
            Text(alert.date)
                .font(.caption)
                .foregroundColor(.white.opacity(0.4))
        }
    }

    // MARK: - Response Buttons

    private var responseButtons: some View {
        HStack(spacing: 12) {
            // REJECT button
            Button(action: {
                guard !isResponding else { return }
                isResponding = true
                Task {
                    await viewModel.respond(to: alert, status: .rejected)
                    isResponding = false
                }
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                    Text("REJECT")
                        .font(.system(size: 14, weight: .bold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.red.opacity(0.2))
                .foregroundColor(Color(red: 1.0, green: 0.35, blue: 0.35))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(Color.red.opacity(0.4), lineWidth: 1)
                )
                .cornerRadius(8)
            }
            .disabled(isResponding)

            // ACCEPT button
            Button(action: {
                guard !isResponding else { return }
                isResponding = true
                Task {
                    await viewModel.respond(to: alert, status: .accepted)
                    isResponding = false
                }
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16))
                    Text("ACCEPT")
                        .font(.system(size: 14, weight: .bold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.green.opacity(0.2))
                .foregroundColor(Color(red: 0.2, green: 0.85, blue: 0.4))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(Color.green.opacity(0.4), lineWidth: 1)
                )
                .cornerRadius(8)
            }
            .disabled(isResponding)
        }
        .padding(.top, 4)
    }

    // MARK: - Computed helpers

    private var statusColor: Color {
        switch status {
        case .pending:
            return Color(red: 0.96, green: 0.62, blue: 0.0)
        case .accepted:
            return Color(red: 0.2, green: 0.85, blue: 0.4)
        case .rejected:
            return Color(red: 1.0, green: 0.35, blue: 0.35)
        }
    }

    private var borderColor: Color {
        switch status {
        case .pending:
            return Color(red: 0.96, green: 0.62, blue: 0.0).opacity(0.5)
        case .accepted:
            return Color.green.opacity(0.4)
        case .rejected:
            return Color.red.opacity(0.4)
        }
    }

    private var formattedDate: String {
        guard let date = alert.sentAtDate else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = "dd MMM HH:mm"
        return formatter.string(from: date)
    }
}

#Preview {
    AlertsView()
        .environmentObject(AlertsViewModel())
}