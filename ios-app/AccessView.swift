import SwiftUI

struct AccessView: View {
    @State private var email: String = ""
    @State private var isLoading = false
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var hasAccess = false
    
    init() {
        // S'abonner aux notifications de token reçu
        NotificationCenter.default.addObserver(
            forName: .didReceiveAccessToken,
            object: nil,
            queue: .main
        ) { notification in
            if let token = notification.userInfo?["token"] as? String {
                self.validateToken(token)
            }
        }
    }
    
    var body: some View {
        NavigationView {
            if hasAccess {
                ReaderView() // Vue du lecteur
            } else {
                VStack(spacing: 20) {
                    Image("book-cover")
                        .resizable()
                        .scaledToFit()
                        .frame(height: 200)
                    
                    Text("ESCLAVE DIGITAL")
                        .font(.title)
                        .fontWeight(.bold)
                    
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Accéder à votre livre")
                            .font(.headline)
                        
                        TextField("Votre email", text: $email)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                        
                        Button(action: verifyAccess) {
                            if isLoading {
                                ProgressView()
                            } else {
                                Text("Vérifier l'accès")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(email.isEmpty || isLoading)
                        
                        Button("Je n'ai pas encore acheté le livre") {
                            if let url = URL(string: "https://esclavedigital.org") {
                                UIApplication.shared.open(url)
                            }
                        }
                        .font(.footnote)
                        .padding(.top)
                    }
                    .padding()
                    
                    Spacer()
                }
                .alert("Erreur", isPresented: $showError) {
                    Button("OK") { }
                } message: {
                    Text(errorMessage)
                }
                .navigationBarTitleDisplayMode(.inline)
            }
        }
    }
    
    private func validateToken(_ token: String) {
        isLoading = true
        
        Task {
            do {
                let result = try await verifyToken(token)
                DispatchQueue.main.async {
                    if result.isValid {
                        hasAccess = true
                        // Sauvegarder le token d'accès localement
                        UserDefaults.standard.set(token, forKey: "accessToken")
                    } else {
                        showError = true
                        errorMessage = "Token invalide. Veuillez réessayer avec votre email."
                    }
                    isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    showError = true
                    errorMessage = "Erreur de connexion. Veuillez réessayer."
                    isLoading = false
                }
            }
        }
    }
    
    private func verifyAccess() {
        isLoading = true
        
        Task {
            do {
                let result = try await verifyEmailAccess(email: email)
                DispatchQueue.main.async {
                    if result.hasAccess {
                        hasAccess = true
                        // Sauvegarder le token d'accès localement
                        UserDefaults.standard.set(result.token, forKey: "accessToken")
                    } else {
                        showError = true
                        errorMessage = "Email non reconnu. Vérifiez que vous avez utilisé l'email de votre achat."
                    }
                    isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    showError = true
                    errorMessage = "Erreur de connexion. Veuillez réessayer."
                    isLoading = false
                }
            }
        }
    }
}

struct AccessView_Previews: PreviewProvider {
    static var previews: some View {
        AccessView()
    }
} 