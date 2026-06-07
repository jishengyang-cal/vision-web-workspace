import SwiftUI

#if canImport(UIKit) && canImport(WebKit)
import UIKit
import WebKit
#endif

struct BrowserWindowView: View {
    @Binding var window: GatewayWindow
    @State private var address = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text(window.title)
                    .font(.headline)
                    .frame(width: 92, alignment: .leading)

                TextField("URL", text: $address)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        window.url = normalizedAddress(address)
                    }

                Button("Go") {
                    window.url = normalizedAddress(address)
                }
            }
            .padding(12)

            WebSurfaceView(urlString: window.url, reloadToken: window.navigation?.reloadToken ?? 0)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: 370, height: 650)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .onAppear {
            address = window.url
        }
        .onChange(of: window.url) { _, newValue in
            address = newValue
        }
    }

    private func normalizedAddress(_ rawValue: String) -> String {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return trimmed
        }
        return "https://\(trimmed)"
    }
}

#if canImport(UIKit) && canImport(WebKit)
struct WebSurfaceView: UIViewRepresentable {
    let urlString: String
    let reloadToken: Int

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        load(urlString, into: webView)
        context.coordinator.lastReloadToken = reloadToken
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastReloadToken != reloadToken {
            context.coordinator.lastReloadToken = reloadToken
            webView.reload()
            return
        }

        guard webView.url?.absoluteString != normalizedURL?.absoluteString else {
            return
        }
        load(urlString, into: webView)
    }

    private var normalizedURL: URL? {
        let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://")
            ? trimmed
            : "https://\(trimmed)"
        return URL(string: normalized)
    }

    private func load(_ urlString: String, into webView: WKWebView) {
        guard let url = normalizedURL else {
            return
        }
        webView.load(URLRequest(url: url))
    }

    final class Coordinator {
        var lastReloadToken = 0
    }
}
#else
struct WebSurfaceView: View {
    let urlString: String
    let reloadToken: Int

    var body: some View {
        Text(urlString)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
#endif
