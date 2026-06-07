import SwiftUI

struct WorkspaceMenuBarView: View {
    @ObservedObject var store: WorkspaceStore

    private var activeWindow: GatewayWindow? {
        guard let activeWindowId = store.layout.activeWindowId else {
            return nil
        }

        return store.layout.windows.first { $0.id == activeWindowId }
    }

    var body: some View {
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

            Button("Save") {
                store.save()
            }

            Spacer(minLength: 12)

            if let activeWindow {
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

            Slider(
                value: Binding(
                    get: { window.opacity },
                    set: { store.setOpacity(windowId: window.id, opacity: $0) }
                ),
                in: WorkspaceWindowDefaults.minimumOpacity...WorkspaceWindowDefaults.maximumOpacity,
                step: 0.05
            )
            .frame(width: 120)

            Button(window.locked ? "Unlock" : "Lock") {
                store.toggleEditLock(windowId: window.id)
            }

            Button("Close") {
                store.close(windowId: window.id)
            }
        }
    }
}

#Preview {
    WorkspaceMenuBarView(store: WorkspaceStore())
        .frame(width: 980)
}
