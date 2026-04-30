//
//  ProfileView.swift
//  DFP-NEO Mobile
//
//  User profile and settings view
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        NavigationView {
            ZStack {
                Color.black.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {

                        // Profile header
                        VStack(spacing: 16) {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.96, green: 0.62, blue: 0.0).opacity(0.2))
                                    .frame(width: 100, height: 100)
                                Image(systemName: "person.fill")
                                    .font(.system(size: 48))
                                    .foregroundColor(Color(red: 0.96, green: 0.62, blue: 0.0))
                            }

                            VStack(spacing: 6) {
                                Text(authViewModel.currentUser?.effectiveDisplayName ?? "User")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.white)

                                Text(authViewModel.currentUser?.userId ?? "")
                                    .font(.subheadline)
                                    .foregroundColor(.white.opacity(0.6))

                                Text(authViewModel.currentUser?.role.rawValue.capitalized ?? "")
                                    .font(.caption)
                                    .foregroundColor(Color(red: 0.96, green: 0.62, blue: 0.0))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 4)
                                    .background(Color(red: 0.96, green: 0.62, blue: 0.0).opacity(0.15))
                                    .cornerRadius(8)
                            }
                        }
                        .padding(.top, 32)

                        // Account info card
                        VStack(spacing: 0) {
                            ProfileInfoRow(
                                icon: "person.fill",
                                title: "Full Name",
                                value: authViewModel.currentUser?.effectiveDisplayName ?? "—"
                            )
                            Divider().background(Color.gray.opacity(0.3))
                            ProfileInfoRow(
                                icon: "number",
                                title: "User ID",
                                value: authViewModel.currentUser?.userId ?? "—"
                            )
                            Divider().background(Color.gray.opacity(0.3))
                            ProfileInfoRow(
                                icon: "envelope.fill",
                                title: "Email",
                                value: authViewModel.currentUser?.email ?? "—"
                            )
                            Divider().background(Color.gray.opacity(0.3))
                            ProfileInfoRow(
                                icon: "shield.fill",
                                title: "Role",
                                value: authViewModel.currentUser?.role.rawValue.capitalized ?? "—"
                            )
                        }
                        .background(Color.gray.opacity(0.15))
                        .cornerRadius(12)
                        .padding(.horizontal)

                        // App info card
                        VStack(spacing: 0) {
                            ProfileInfoRow(
                                icon: "airplane",
                                title: "App",
                                value: "DFP-NEO Mobile"
                            )
                            Divider().background(Color.gray.opacity(0.3))
                            ProfileInfoRow(
                                icon: "server.rack",
                                title: "Server",
                                value: "app.dfp-neo.com"
                            )
                        }
                        .background(Color.gray.opacity(0.15))
                        .cornerRadius(12)
                        .padding(.horizontal)

                        // Sign out button
                        Button(action: {
                            authViewModel.logout()
                        }) {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                Text("Sign Out")
                                    .fontWeight(.semibold)
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.red.opacity(0.8))
                            .cornerRadius(12)
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 40)
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct ProfileInfoRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(Color(red: 0.96, green: 0.62, blue: 0.0))
                .frame(width: 24)

            Text(title)
                .foregroundColor(.white.opacity(0.6))
                .font(.subheadline)

            Spacer()

            Text(value)
                .foregroundColor(.white)
                .font(.subheadline)
                .multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}