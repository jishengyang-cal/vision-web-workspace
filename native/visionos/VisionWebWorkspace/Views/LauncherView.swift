import SwiftUI

struct LauncherView: View {
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @State private var isWorkspaceOpen = false

    var body: some View {
        VStack(spacing: 24) {
            Text("Vision Web Workspace")
                .font(.largeTitle)
                .fontWeight(.semibold)

            Button {
                Task {
                    if isWorkspaceOpen {
                        await dismissImmersiveSpace()
                        isWorkspaceOpen = false
                    } else {
                        await openImmersiveSpace(id: WorkspaceConstants.immersiveSpaceID)
                        isWorkspaceOpen = true
                    }
                }
            } label: {
                Text(isWorkspaceOpen ? "Close Workspace" : "Open Workspace")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(40)
    }
}

#Preview {
    LauncherView()
}
