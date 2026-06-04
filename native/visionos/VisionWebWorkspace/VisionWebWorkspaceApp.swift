import SwiftUI

@main
struct VisionWebWorkspaceApp: App {
    var body: some Scene {
        WindowGroup {
            LauncherView()
        }

        ImmersiveSpace(id: WorkspaceConstants.immersiveSpaceID) {
            FollowWorkspaceImmersiveView()
        }
        .immersionStyle(selection: .constant(.mixed), in: .mixed)
    }
}
