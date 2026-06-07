import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

struct NativeWebWindowHostView: View {
    @Environment(\.openWindow) private var openWindow

    @ObservedObject var store: WorkspaceStore
    let windowID: String?

    var body: some View {
        Group {
            if let windowID,
               let window = store.layout.windows.first(where: { $0.id == windowID }) {
                NativeRemoteWebWindowView(
                    window: store.binding(for: window),
                    createSibling: {
                        Task {
                            guard let created = await store.createWindow(kind: window.kind, sourceWindow: window) else {
                                return
                            }
                            store.focus(windowId: created.id)
                            openWindow(id: WorkspaceConstants.nativeWebWindowGroupID, value: created.id)
                        }
                    },
                    minimize: {
                        store.minimize(windowId: window.id)
                    },
                    restore: {
                        store.restore(windowId: window.id)
                    },
                    navigateBack: {
                        store.navigateBack(windowId: window.id)
                    },
                    navigateForward: {
                        store.navigateForward(windowId: window.id)
                    },
                    reload: {
                        store.reload(windowId: window.id)
                    },
                    toggleBookmark: {
                        store.toggleBookmark(windowId: window.id)
                    },
                    close: {
                        store.close(windowId: window.id)
                    }
                )
            } else {
                VStack(spacing: 12) {
                    Text("Remote web window unavailable")
                        .font(.headline)
                    Text("The requested workspace window is no longer present in the layout.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(32)
            }
        }
    }
}

struct NativeRemoteWebWindowView: View {
    @Environment(\.dismiss) private var dismiss

    @Binding var window: GatewayWindow
    let createSibling: () -> Void
    let minimize: () -> Void
    let restore: () -> Void
    let navigateBack: () -> Void
    let navigateForward: () -> Void
    let reload: () -> Void
    let toggleBookmark: () -> Void
    let close: () -> Void

    @State private var address = ""

    var body: some View {
        Group {
            if window.minimized == true {
                minimizedBody
            } else {
                windowBody
            }
        }
        .onAppear {
            address = window.url
        }
        .onChange(of: window.url) { _, newValue in
            address = newValue
        }
    }

    private var windowBody: some View {
        VStack(spacing: 0) {
            toolbar

            WebSurfaceView(urlString: window.url, reloadToken: window.navigation?.reloadToken ?? 0)
                .frame(minWidth: 520, minHeight: 360)
                .opacity(window.opacity)
        }
        .frame(minWidth: 640, minHeight: 460)
        .background(.regularMaterial)
    }

    private var minimizedBody: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                Circle()
                    .fill(kindColor)
                    .frame(width: 12, height: 12)
                Text(window.title)
                    .font(.headline)
            }

            Button("Restore") {
                restore()
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(width: 280, height: 140)
        .background(.regularMaterial)
    }

    private var toolbar: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Circle()
                    .fill(kindColor)
                    .frame(width: 10, height: 10)

                Text(window.title)
                    .font(.headline)
                    .lineLimit(1)
                    .frame(width: 112, alignment: .leading)

                Button("Back") {
                    navigateBack()
                }
                .disabled(!canGoBack)

                Button("Forward") {
                    navigateForward()
                }
                .disabled(!canGoForward)

                Button("Reload") {
                    reload()
                }

                TextField("URL", text: $address)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit(loadAddress)

                Button("Go") {
                    loadAddress()
                }

                Button("Copy") {
                    copyURL()
                }

                Button(window.bookmarkId == nil ? "Save" : "Saved") {
                    toggleBookmark()
                }

                Button("+") {
                    createSibling()
                }

                Button("-") {
                    minimize()
                }

                Button("x") {
                    close()
                    dismiss()
                }
            }

            HStack(spacing: 10) {
                Text("Opacity")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Slider(
                    value: Binding(
                        get: { window.opacity },
                        set: {
                            window.opacity = min(
                                WorkspaceWindowDefaults.maximumOpacity,
                                max(WorkspaceWindowDefaults.minimumOpacity, $0)
                            )
                            touchWindow()
                        }
                    ),
                    in: WorkspaceWindowDefaults.minimumOpacity...WorkspaceWindowDefaults.maximumOpacity,
                    step: 0.05
                )
                .frame(width: 160)

                Text(window.surfaceMode)
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Spacer()
            }
        }
        .padding(12)
        .background(.thinMaterial)
    }

    private var canGoBack: Bool {
        (window.navigation?.currentIndex ?? 0) > 0
    }

    private var canGoForward: Bool {
        guard let navigation = window.navigation else {
            return false
        }

        return navigation.currentIndex < navigation.entries.count - 1
    }

    private var kindColor: Color {
        switch window.kind {
        case "terminal":
            .green
        case "code":
            .blue
        case "browser":
            .orange
        case "docs":
            .purple
        case "logs":
            .red
        default:
            .gray
        }
    }

    private func loadAddress() {
        let nextURL = normalizedAddress(address)
        let navigation = normalizedNavigation()
        if navigation.entries[navigation.currentIndex] == nextURL {
            window.url = nextURL
            window.navigation = navigation
            touchWindow()
            return
        }

        var entries = Array(navigation.entries.prefix(navigation.currentIndex + 1))
        entries.append(nextURL)
        window.url = nextURL
        window.bookmarkId = nil
        window.navigation = GatewayWindowNavigation(
            entries: entries,
            currentIndex: entries.count - 1,
            reloadToken: navigation.reloadToken
        )
        touchWindow()
    }

    private func normalizedNavigation() -> GatewayWindowNavigation {
        guard let navigation = window.navigation, !navigation.entries.isEmpty else {
            return GatewayWindowNavigation(entries: [window.url], currentIndex: 0, reloadToken: 0)
        }

        let currentIndex = min(max(0, navigation.currentIndex), navigation.entries.count - 1)
        if navigation.entries[currentIndex] == window.url {
            return GatewayWindowNavigation(
                entries: navigation.entries,
                currentIndex: currentIndex,
                reloadToken: navigation.reloadToken
            )
        }

        var entries = Array(navigation.entries.prefix(currentIndex + 1))
        entries.append(window.url)
        return GatewayWindowNavigation(entries: entries, currentIndex: entries.count - 1, reloadToken: navigation.reloadToken)
    }

    private func normalizedAddress(_ rawValue: String) -> String {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return trimmed
        }
        return "https://\(trimmed)"
    }

    private func touchWindow() {
        window.updatedAt = ISO8601DateFormatter().string(from: Date())
    }

    private func copyURL() {
        #if canImport(UIKit)
        UIPasteboard.general.string = window.url
        #endif
    }
}

#Preview {
    NativeWebWindowHostView(store: WorkspaceStore(), windowID: "terminal")
}
