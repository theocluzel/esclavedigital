import UIKit
import SwiftUI

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        let contentView = AccessView()
        
        // Gérer les URLs d'ouverture au lancement
        if let urlContext = connectionOptions.urlContexts.first {
            handleIncomingURL(urlContext.url)
        }
        
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = UIHostingController(rootView: contentView)
        self.window = window
        window.makeKeyAndVisible()
    }
    
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // Gérer les URLs quand l'app est déjà lancée
        if let url = URLContexts.first?.url {
            handleIncomingURL(url)
        }
    }
    
    private func handleIncomingURL(_ url: URL) {
        guard url.scheme == "esclavedigital",
              url.host == "access",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
              let tokenItem = components.queryItems?.first(where: { $item.name == "token" }),
              let token = tokenItem.value else {
            return
        }
        
        // Notifier l'app que nous avons reçu un token valide
        NotificationCenter.default.post(
            name: .didReceiveAccessToken,
            object: nil,
            userInfo: ["token": token]
        )
    }
}

// Extension pour la notification personnalisée
extension Notification.Name {
    static let didReceiveAccessToken = Notification.Name("didReceiveAccessToken")
} 