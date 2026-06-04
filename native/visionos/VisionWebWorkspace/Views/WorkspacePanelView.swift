import SwiftUI

struct WorkspacePanelView: View {
    @Binding var panelState: WorkspacePanelState
    @State private var windows = WorkspaceWebWindow.defaults

    var body: some View {
        VStack(spacing: 0) {
            toolbar

            Divider()

            HStack(spacing: 14) {
                ForEach($windows) { $window in
                    BrowserWindowView(window: $window)
                }
            }
            .padding(18)
        }
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .glassBackgroundEffect()
    }

    private var toolbar: some View {
        HStack(spacing: 12) {
            Text("Workspace")
                .font(.title3)
                .fontWeight(.semibold)

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
