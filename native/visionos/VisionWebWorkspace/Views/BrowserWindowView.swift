import SwiftUI

#if canImport(UIKit) && canImport(WebKit)
import UIKit
import WebKit
#endif

struct BrowserWindowView: View {
    @Binding var window: WorkspaceWebWindow
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
                        window.urlString = normalizedAddress(address)
                    }

                Button("Go") {
                    window.urlString = normalizedAddress(address)
                }
            }
            .padding(12)

            WebSurfaceView(urlString: window.urlString)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: 370, height: 650)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .onAppear {
            address = window.urlString
        }
        .onChange(of: window.urlString) { _, newValue in
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

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        load(urlString, into: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
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
}
#else
struct WebSurfaceView: View {
    let urlString: String

    var body: some View {
        Text(urlString)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
#endif
