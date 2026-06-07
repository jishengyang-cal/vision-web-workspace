import SwiftUI

struct LauncherView: View {
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @Environment(\.openWindow) private var openWindow
    @ObservedObject var store: WorkspaceStore
    @State private var activeSpaceID: String?

    var body: some View {
        VStack(spacing: 24) {
            Text("Vision Web Workspace")
                .font(.largeTitle)
                .fontWeight(.semibold)

            VStack(spacing: 12) {
                Text("Native Web Window Mode")
                    .font(.headline)

                HStack(spacing: 10) {
                    nativeWindowButton("Terminal", kind: "terminal")
                    nativeWindowButton("Code", kind: "code")
                    nativeWindowButton("Browser", kind: "browser")
                    nativeWindowButton("Docs", kind: "docs")
                    nativeWindowButton("Logs", kind: "logs")
                }

                if let bookmarks = store.layout.bookmarks, !bookmarks.isEmpty {
                    HStack(spacing: 10) {
                        ForEach(bookmarks) { bookmark in
                            Button(bookmark.title) {
                                openBookmark(bookmark)
                            }
                            .disabled(store.layout.windows.count >= WorkspaceWindowDefaults.maximumWindowCount)
                        }
                    }
                }

                Divider()
                    .padding(.vertical, 4)

                Text("Immersive Modes")
                    .font(.headline)

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
        .task {
            store.load()
        }
    }

    private func nativeWindowButton(_ title: String, kind: String) -> some View {
        Button(title) {
            openNativeWindow(kind: kind)
        }
        .disabled(store.layout.windows.count >= WorkspaceWindowDefaults.maximumWindowCount)
    }

    private func openNativeWindow(kind: String) {
        Task {
            guard let window = await store.createWindow(kind: kind) else {
                return
            }
            openWindow(id: WorkspaceConstants.nativeWebWindowGroupID, value: window.id)
        }
    }

    private func openBookmark(_ bookmark: GatewayBookmark) {
        guard let window = store.openBookmark(bookmark) else {
            return
        }
        openWindow(id: WorkspaceConstants.nativeWebWindowGroupID, value: window.id)
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
    LauncherView(store: WorkspaceStore())
}
