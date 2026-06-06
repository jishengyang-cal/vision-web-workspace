import SwiftUI

struct LauncherView: View {
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @State private var activeSpaceID: String?

    var body: some View {
        VStack(spacing: 24) {
            Text("Vision Web Workspace")
                .font(.largeTitle)
                .fontWeight(.semibold)

            VStack(spacing: 12) {
                Button {
                    toggleSpace(WorkspaceConstants.immersiveSpaceID)
                } label: {
                    Text(activeSpaceID == WorkspaceConstants.immersiveSpaceID ? "Close Workspace" : "Open Mixed Workspace")
                }
                .buttonStyle(.borderedProminent)

                Button {
                    toggleSpace(WorkspaceConstants.officeEnvironmentSpaceID)
                } label: {
                    Text(activeSpaceID == WorkspaceConstants.officeEnvironmentSpaceID ? "Close Office" : "Enter Office Environment")
                }

                Button {
                    toggleSpace(WorkspaceConstants.loungeEnvironmentSpaceID)
                } label: {
                    Text(activeSpaceID == WorkspaceConstants.loungeEnvironmentSpaceID ? "Close Water Lounge" : "Enter Water Lounge")
                }
            }

            if activeSpaceID != nil {
                Button("Close Immersive Space") {
                    closeActiveSpace()
                }
            }
        }
        .padding(40)
    }

    private func toggleSpace(_ spaceID: String) {
        Task {
            if activeSpaceID == spaceID {
                await dismissImmersiveSpace()
                activeSpaceID = nil
                return
            }

            if activeSpaceID != nil {
                await dismissImmersiveSpace()
                activeSpaceID = nil
            }

            let result = await openImmersiveSpace(id: spaceID)
            if case .opened = result {
                activeSpaceID = spaceID
            }
        }
    }

    private func closeActiveSpace() {
        Task {
            await dismissImmersiveSpace()
            activeSpaceID = nil
        }
    }
}

#Preview {
    LauncherView()
}
