import SwiftUI

struct WorkspacePanelView: View {
    @Binding var panelState: WorkspacePanelState
    @StateObject private var store = WorkspaceStore()

    var body: some View {
        VStack(spacing: 0) {
            toolbar

            Divider()

            HStack(spacing: 14) {
                ForEach(store.layout.windows) { window in
                    BrowserWindowView(window: store.binding(for: window))
                }
            }
            .padding(18)

            if let errorMessage = store.errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 10)
            }
        }
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .glassBackgroundEffect()
        .onAppear {
            store.load()
        }
    }

    private var toolbar: some View {
        HStack(spacing: 12) {
            Text("Workspace")
                .font(.title3)
                .fontWeight(.semibold)

            Button("Terminal") {
                store.open(kind: "terminal")
            }

            Button("Code") {
                store.open(kind: "code")
            }

            Button("Browser") {
                store.open(kind: "browser")
            }

            Button("Save") {
                store.save()
            }

            Spacer()

            Button("Left") {
                panelState.horizontalOffsetMeters -= 0.08
            }

            Button("Right") {
                panelState.horizontalOffsetMeters += 0.08
            }

            Button("Closer") {
                panelState.distanceMeters = max(0.85, panelState.distanceMeters - 0.08)
            }

            Button("Farther") {
                panelState.distanceMeters = min(2.2, panelState.distanceMeters + 0.08)
            }

            Button("Smaller") {
                panelState.scale = max(0.75, panelState.scale - 0.05)
            }

            Button("Larger") {
                panelState.scale = min(1.25, panelState.scale + 0.05)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }
}
