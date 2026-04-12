//
//  ContentView.swift
//  DFP-NEO Mobile
//
//  Main navigation controller
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    
    var body: some View {
        Group {
            if authViewModel.isAuthenticated && !authViewModel.isSessionLocked {
                // Main app interface
                ScheduleView()
            } else if authViewModel.isSessionLocked {
                // Biometric unlock screen
                BiometricUnlockView()
            } else {
                // Login screen
                LoginView()
            }
        }
        .animation(.easeInOut, value: authViewModel.isAuthenticated)
        .animation(.easeInOut, value: authViewModel.isSessionLocked)
    }
}

struct BiometricUnlockView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            
            VStack(spacing: 30) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.white.opacity(0.8))
                
                Text("Session Locked")
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                Text("Use Face ID or Touch ID to unlock")
                    .font(.body)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                
                Button(action: {
                    Task {
                        await authViewModel.unlockWithBiometrics()
                    }
                }) {
                    HStack {
                        Image(systemName: "faceid")
                        Text("Unlock")
                    }
                    .font(.headline)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.white)
                    .cornerRadius(12)
                }
                .padding(.horizontal, 40)
                .padding(.top, 20)
                
                Button(action: {
                    authViewModel.logout()
                }) {
                    Text("Sign Out")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.6))
                }
                .padding(.top, 10)
            }
        }
        .onAppear {
            // Automatically prompt for biometric unlock
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 second delay
                await authViewModel.unlockWithBiometrics()
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthViewModel())
}