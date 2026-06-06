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

        ImmersiveSpace(id: WorkspaceConstants.officeEnvironmentSpaceID) {
            ImmersiveEnvironmentView(kind: .office)
        }
        .immersionStyle(selection: .constant(.full), in: .full)

        ImmersiveSpace(id: WorkspaceConstants.loungeEnvironmentSpaceID) {
            ImmersiveEnvironmentView(kind: .lounge)
        }
        .immersionStyle(selection: .constant(.full), in: .full)
    }
}
