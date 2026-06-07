import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

private struct WorkspaceDiagnostics: Codable {
    var generatedAt: String
    var appVersion: String
    var buildNumber: String
    var layout: GatewayLayout
}

struct WorkspaceMenuBarView: View {
    @ObservedObject var store: WorkspaceStore

    private var activeWindow: GatewayWindow? {
        guard let activeWindowId = store.layout.activeWindowId else {
            return nil
        }

        return store.layout.windows.first { $0.id == activeWindowId }
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Remote Web Workspace")
                        .font(.headline)
                    Text("\(store.layout.windows.count)/\(WorkspaceWindowDefaults.maximumWindowCount) screen-locked windows")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Divider()
                    .frame(height: 42)

                windowButton("Terminal", kind: "terminal")
                windowButton("Code", kind: "code")
                windowButton("Browser", kind: "browser")
                windowButton("Docs", kind: "docs")
                windowButton("Logs", kind: "logs")

                Divider()
                    .frame(height: 42)

                Button("Save") {
                    store.save()
                }

                Button("Restore") {
                    store.restoreSavedLayout()
                }

                Button("Reset") {
                    store.resetLayout()
                }

                Button("Copy Diagnostics") {
                    copyDiagnostics()
                }

                if let activeWindow {
                    Divider()
                        .frame(height: 42)
                    activeWindowControls(activeWindow)
                }

                if let errorMessage = store.errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
        }
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .glassBackgroundEffect()
    }

    private func windowButton(_ title: String, kind: String) -> some View {
        Button(title) {
            store.open(kind: kind)
        }
        .disabled(store.layout.windows.count >= WorkspaceWindowDefaults.maximumWindowCount)
    }

    private func activeWindowControls(_ window: GatewayWindow) -> some View {
        HStack(spacing: 10) {
            Text(window.title)
                .font(.caption)
                .lineLimit(1)
                .frame(width: 96, alignment: .trailing)

            Button("Back") {
                store.navigateBack(windowId: window.id)
            }
            .disabled(!canGoBack(window))

            Button("Forward") {
                store.navigateForward(windowId: window.id)
            }
            .disabled(!canGoForward(window))

            Button("Reload") {
                store.reload(windowId: window.id)
            }

            Button(window.bookmarkId == nil ? "Bookmark" : "Unsave") {
                store.toggleBookmark(windowId: window.id)
            }

            Slider(
                value: Binding(
                    get: { window.opacity },
                    set: { store.setOpacity(windowId: window.id, opacity: $0) }
                ),
                in: WorkspaceWindowDefaults.minimumOpacity...WorkspaceWindowDefaults.maximumOpacity,
                step: 0.05
            )
            .frame(width: 120)

            Picker(
                "Lock mode",
                selection: Binding(
                    get: { window.lockMode },
                    set: { store.setLockMode(windowId: window.id, lockMode: $0) }
                )
            ) {
                Text("screen").tag("screen-locked")
                Text("world").tag("world-locked")
                Text("free").tag("unlocked")
            }
            .pickerStyle(.segmented)
            .frame(width: 190)

            Button(window.locked ? "Unlock" : "Lock") {
                store.toggleEditLock(windowId: window.id)
            }

            Button("Close") {
                store.close(windowId: window.id)
            }
        }
    }

    private func copyDiagnostics() {
        #if canImport(UIKit)
        let info = Bundle.main.infoDictionary ?? [:]
        let diagnostics = WorkspaceDiagnostics(
            generatedAt: ISO8601DateFormatter().string(from: Date()),
            appVersion: info["CFBundleShortVersionString"] as? String ?? "unknown",
            buildNumber: info["CFBundleVersion"] as? String ?? "unknown",
            layout: store.layout
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        guard
            let data = try? encoder.encode(diagnostics),
            let text = String(data: data, encoding: .utf8)
        else {
            store.errorMessage = "Diagnostics unavailable"
            return
        }

        UIPasteboard.general.string = text
        store.errorMessage = "Diagnostics copied"
        #else
        store.errorMessage = "Clipboard unavailable"
        #endif
    }

    private func canGoBack(_ window: GatewayWindow) -> Bool {
        (window.navigation?.currentIndex ?? 0) > 0
    }

    private func canGoForward(_ window: GatewayWindow) -> Bool {
        guard let navigation = window.navigation else {
            return false
        }

        return navigation.currentIndex < navigation.entries.count - 1
    }
}

#Preview {
    WorkspaceMenuBarView(store: WorkspaceStore())
        .frame(width: 980)
}
