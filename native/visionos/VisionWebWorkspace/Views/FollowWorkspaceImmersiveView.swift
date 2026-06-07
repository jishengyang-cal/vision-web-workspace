import ARKit
import QuartzCore
import RealityKit
import SwiftUI

struct FollowWorkspaceImmersiveView: View {
    @StateObject private var store = WorkspaceStore()
    @State private var rootEntity = Entity()
    @State private var arkitSession = ARKitSession()
    @State private var worldTracking = WorldTrackingProvider()
    @State private var didStartWorldTracking = false

    var body: some View {
        RealityView { content, attachments in
            rootEntity.name = WorkspaceConstants.rootEntityName
            updateRootPose()
            content.add(rootEntity)

            attachMenu(attachments)
            attachWindows(attachments)
        } update: { _, attachments in
            updateRootPose()
            attachMenu(attachments)
            attachWindows(attachments)
        } attachments: {
            Attachment(id: WorkspaceConstants.menuAttachmentID) {
                WorkspaceMenuBarView(store: store)
                    .frame(width: 1120, height: 104)
            }

            ForEach(store.layout.windows) { window in
                Attachment(id: WorkspaceConstants.windowAttachmentID(window.id)) {
                    SpatialRemoteWebWindowView(
                        window: store.binding(for: window),
                        focus: {
                            store.focus(windowId: window.id)
                        },
                        close: {
                            store.close(windowId: window.id)
                        }
                    )
                }
            }
        }
        .task {
            store.load()
            await startWorldTracking()

            while !Task.isCancelled {
                await MainActor.run {
                    updateRootPose()
                }
                try? await Task.sleep(nanoseconds: 16_000_000)
            }
        }
    }

    private func startWorldTracking() async {
        guard !didStartWorldTracking, WorldTrackingProvider.isSupported else {
            return
        }

        do {
            try await arkitSession.run([worldTracking])
            didStartWorldTracking = true
        } catch {
            didStartWorldTracking = false
        }
    }

    private func updateRootPose() {
        guard
            didStartWorldTracking,
            let deviceAnchor = worldTracking.queryDeviceAnchor(atTimestamp: CACurrentMediaTime())
        else {
            return
        }

        rootEntity.transform = Transform(matrix: deviceAnchor.originFromAnchorTransform)
    }

    private func attachMenu(_ attachments: RealityViewAttachments) {
        guard let menu = attachments.entity(for: WorkspaceConstants.menuAttachmentID) else {
            return
        }

        menu.name = WorkspaceConstants.menuEntityName
        menu.position = [0, 0.62, -1.05]
        menu.orientation = simd_quatf(angle: degreesToRadians(-2), axis: [1, 0, 0])

        if menu.parent == nil {
            rootEntity.addChild(menu)
        }
    }

    private func attachWindows(_ attachments: RealityViewAttachments) {
        let activeWindowIDs = Set(store.layout.windows.map(\.id))
        removeClosedWindowEntities(activeWindowIDs: activeWindowIDs)

        for window in store.layout.windows {
            guard let entity = attachments.entity(for: WorkspaceConstants.windowAttachmentID(window.id)) else {
                continue
            }

            entity.name = WorkspaceConstants.windowEntityName(window.id)
            entity.position = [
                Float(window.pose3D.x),
                Float(window.pose3D.y),
                Float(window.pose3D.z) - Float(window.zIndex) * 0.002
            ]
            entity.scale = SIMD3<Float>(repeating: Float(window.pose3D.scale))
            entity.orientation = orientation(for: window.pose3D)

            if entity.parent == nil {
                rootEntity.addChild(entity)
            }
        }
    }

    private func removeClosedWindowEntities(activeWindowIDs: Set<String>) {
        for child in Array(rootEntity.children) {
            guard child.name.hasPrefix(WorkspaceConstants.windowEntityPrefix) else {
                continue
            }

            let windowID = String(child.name.dropFirst(WorkspaceConstants.windowEntityPrefix.count))
            if !activeWindowIDs.contains(windowID) {
                child.removeFromParent()
            }
        }
    }

    private func orientation(for pose: GatewayWindowPose3D) -> simd_quatf {
        let yaw = simd_quatf(angle: degreesToRadians(pose.yawDegrees), axis: [0, 1, 0])
        let pitch = simd_quatf(angle: degreesToRadians(pose.pitchDegrees), axis: [1, 0, 0])
        let roll = simd_quatf(angle: degreesToRadians(pose.rollDegrees), axis: [0, 0, 1])

        return yaw * pitch * roll
    }

    private func degreesToRadians(_ degrees: Double) -> Float {
        Float(degrees * .pi / 180)
    }
}
