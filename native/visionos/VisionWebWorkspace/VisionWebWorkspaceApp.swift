import SwiftUI

@main
struct VisionWebWorkspaceApp: App {
    @StateObject private var store = WorkspaceStore()

    var body: some Scene {
        WindowGroup {
            LauncherView(store: store)
        }

        WindowGroup("Remote Web Window", id: WorkspaceConstants.nativeWebWindowGroupID, for: String.self) { $windowID in
            NativeWebWindowHostView(store: store, windowID: windowID)
        }
        .defaultSize(width: 980, height: 720)

        ImmersiveSpace(id: WorkspaceConstants.immersiveSpaceID) {
            FollowWorkspaceImmersiveView(store: store)
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
