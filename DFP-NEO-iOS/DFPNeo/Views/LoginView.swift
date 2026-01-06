//
//  LoginView.swift
//  DFP-NEO Mobile
//
//  Login screen with DFP-NEO branding
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var userId = ""
    @State private var password = ""
    @FocusState private var focusedField: Field?
    
    enum Field {
        case userId, password
    }
    
    var body: some View {
        ZStack {
            // Black background
            Color.black.ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 0) {
                    // Logo
                    Image("dfp-neo-logo")
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 300)
                        .padding(.top, 80)
                        .padding(.bottom, 60)
                    
                    // Login form
                    VStack(spacing: 20) {
                        // User ID field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("USER ID")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.white.opacity(0.7))
                                .tracking(2)
                            
                            TextField("", text: $userId)
                                .textFieldStyle(DFPTextFieldStyle())
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .focused($focusedField, equals: .userId)
                                .submitLabel(.next)
                                .onSubmit {
                                    focusedField = .password
                                }
                        }
                        
                        // Password field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("PASSWORD")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.white.opacity(0.7))
                                .tracking(2)
                            
                            SecureField("", text: $password)
                                .textFieldStyle(DFPTextFieldStyle())
                                .focused($focusedField, equals: .password)
                                .submitLabel(.go)
                                .onSubmit {
                                    login()
                                }
                        }
                        
                        // Error message
                        if let error = authViewModel.errorMessage {
                            Text(error)
                                .font(.subheadline)
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                                .padding(.top, 8)
                        }
                        
                        // Login button
                        Button(action: login) {
                            HStack {
                                if authViewModel.isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .black))
                                } else {
                                    Text("LOG IN")
                                        .fontWeight(.bold)
                                        .tracking(2)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.white)
                            .foregroundColor(.black)
                            .cornerRadius(8)
                        }
                        .disabled(authViewModel.isLoading || !isFormValid)
                        .opacity(isFormValid ? 1.0 : 0.5)
                        .padding(.top, 20)
                    }
                    .padding(.horizontal, 40)
                    
                    Spacer()
                }
            }
        }
        .onAppear {
            // Auto-focus on user ID field
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                focusedField = .userId
            }
        }
    }
    
    private var isFormValid: Bool {
        !userId.isEmpty && !password.isEmpty
    }
    
    private func login() {
        focusedField = nil // Dismiss keyboard
        
        Task {
            await authViewModel.login(userId: userId, password: password)
        }
    }
}

// MARK: - Custom Text Field Style

struct DFPTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding()
            .background(Color.white.opacity(0.1))
            .foregroundColor(.white)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthViewModel())
}