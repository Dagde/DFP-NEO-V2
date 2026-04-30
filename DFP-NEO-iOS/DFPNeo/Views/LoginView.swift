// Views/LoginView.swift
// Updated with native Face ID / Touch ID login support

import SwiftUI
import LocalAuthentication

struct LoginView: View {

    @EnvironmentObject var auth: AuthViewModel
    @State private var biometricType: BiometricType = .none

    enum BiometricType {
        case none, faceID, touchID

        var label: String {
            switch self {
            case .faceID:  return "Sign in with Face ID"
            case .touchID: return "Sign in with Touch ID"
            case .none:    return ""
            }
        }

        var icon: String {
            switch self {
            case .faceID:  return "faceid"
            case .touchID: return "touchid"
            case .none:    return ""
            }
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 16) {

                Spacer().frame(height: 20)

                // App title
                VStack(spacing: 6) {
                    Text("DFP-NEO")
                        .font(.system(size: 38, weight: .bold))
                        .foregroundColor(.white)
                    Text("Flight Scheduler")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(.white.opacity(0.5))
                        .tracking(2)
                }
                .padding(.bottom, 20)

                // Input fields
                VStack(spacing: 12) {
                    TextField("User ID", text: $auth.userId)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .keyboardType(.emailAddress)
                        .padding()
                        .background(Color.white.opacity(0.08))
                        .foregroundColor(.white)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.white.opacity(0.20), lineWidth: 1)
                        )
                        .cornerRadius(10)

                    SecureField("Password", text: $auth.password)
                        .padding()
                        .background(Color.white.opacity(0.08))
                        .foregroundColor(.white)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.white.opacity(0.20), lineWidth: 1)
                        )
                        .cornerRadius(10)
                }
                .padding(.horizontal, 24)

                // Error message
                if let err = auth.errorMessage, !err.isEmpty {
                    Text(err)
                        .foregroundColor(.red)
                        .font(.system(size: 14))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }

                // Login button
                Button {
                    Task { await auth.login() }
                } label: {
                    HStack {
                        if auth.isLoggingIn {
                            ProgressView().tint(.black)
                        }
                        Text(auth.isLoggingIn ? "Signing in..." : "Sign In")
                            .font(.system(size: 17, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.white)
                    .foregroundColor(.black)
                    .cornerRadius(12)
                }
                .disabled(auth.isLoggingIn || auth.userId.isEmpty || auth.password.isEmpty)
                .opacity((auth.userId.isEmpty || auth.password.isEmpty) ? 0.5 : 1.0)
                .padding(.horizontal, 24)
                .padding(.top, 4)

                // Divider
                if biometricType != .none && auth.hasSavedCredentials {
                    HStack {
                        Rectangle().fill(Color.white.opacity(0.15)).frame(height: 1)
                        Text("or")
                            .font(.system(size: 13))
                            .foregroundColor(.white.opacity(0.4))
                            .padding(.horizontal, 12)
                        Rectangle().fill(Color.white.opacity(0.15)).frame(height: 1)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 8)

                    // Face ID / Touch ID button
                    Button {
                        Task { await auth.loginWithBiometrics() }
                    } label: {
                        HStack(spacing: 10) {
                            Text(biometricType.label)
                                .font(.system(size: 16, weight: .medium))
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.white.opacity(0.08))
                        .foregroundColor(.white)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.20), lineWidth: 1)
                        )
                        .cornerRadius(12)
                    }
                    .padding(.horizontal, 24)
                }

                Spacer()

                // Save credentials hint
                if !auth.hasSavedCredentials && biometricType != .none {
                    Text("Sign in once to enable \(biometricType == .faceID ? "Face ID" : "Touch ID") for future logins")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.35))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                        .padding(.bottom, 20)
                }
            }
        }
        .onAppear {
            biometricType = detectBiometricType()
            // Auto-trigger Face ID if credentials are saved
            if auth.hasSavedCredentials && biometricType != .none {
                Task {
                    try? await Task.sleep(nanoseconds: 300_000_000)
                    await auth.loginWithBiometrics()
                }
            }
        }
    }

    private func detectBiometricType() -> BiometricType {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        switch context.biometryType {
        case .faceID:  return .faceID
        case .touchID: return .touchID
        default:       return .none
        }
    }
}