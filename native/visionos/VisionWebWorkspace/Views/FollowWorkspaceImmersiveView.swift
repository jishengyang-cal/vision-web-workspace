import ARKit
import QuartzCore
import RealityKit
import SwiftUI

struct FollowWorkspaceImmersiveView: View {
    @ObservedObject var store: WorkspaceStore
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
                        newWindow: {
                            store.openSibling(of: window)
                        },
                        minimize: {
                            store.minimize(windowId: window.id)
                        },
                        restore: {
                            store.restore(windowId: window.id)
                        },
                        navigateBack: {
                            store.navigateBack(windowId: window.id)
                        },
                        navigateForward: {
                            store.navigateForward(windowId: window.id)
                        },
                        reload: {
                            store.reload(windowId: window.id)
                        },
                        toggleBookmark: {
                            store.toggleBookmark(windowId: window.id)
                        },
                        close: {
                            store.close(windowId: window.id)
                        },
                        scale: { delta in
                            store.scale(windowId: window.id, delta: delta)
                        },
                        rotate: { yawDelta, pitchDelta, rollDelta in
                            store.rotate(
                                windowId: window.id,
                                yawDelta: yawDelta,
                                pitchDelta: pitchDelta,
                                rollDelta: rollDelta
                            )
                        },
                        moveDepth: { delta in
                            store.moveDepth(windowId: window.id, delta: delta)
                        },
                        resize: { widthDelta, heightDelta in
                            store.resize(
                                windowId: window.id,
                                widthDelta: widthDelta,
                                heightDelta: heightDelta
                            )
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
        let minimizedWindowIDs = store.layout.windows
            .filter { $0.minimized == true }
            .map(\.id)
        removeClosedWindowEntities(activeWindowIDs: activeWindowIDs)

        for window in store.layout.windows {
            guard let entity = attachments.entity(for: WorkspaceConstants.windowAttachmentID(window.id)) else {
                continue
            }

            entity.name = WorkspaceConstants.windowEntityName(window.id)
            if window.minimized == true,
               let bubbleIndex = minimizedWindowIDs.firstIndex(of: window.id) {
                let bubblePose = minimizedBubblePose(index: bubbleIndex, count: minimizedWindowIDs.count)
                entity.position = [
                    Float(bubblePose.x),
                    Float(bubblePose.y),
                    Float(bubblePose.z) - Float(bubbleIndex) * 0.001
                ]
                entity.scale = SIMD3<Float>(repeating: Float(bubblePose.scale))
                entity.orientation = orientation(for: bubblePose)
            } else {
                entity.position = [
                    Float(window.pose3D.x),
                    Float(window.pose3D.y),
                    Float(window.pose3D.z) - Float(window.zIndex) * 0.002
                ]
                entity.scale = SIMD3<Float>(repeating: Float(window.pose3D.scale))
                entity.orientation = orientation(for: window.pose3D)
            }

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

    private func minimizedBubblePose(index: Int, count: Int) -> GatewayWindowPose3D {
        let centeredIndex = Double(index) - Double(max(0, count - 1)) / 2.0
        return GatewayWindowPose3D(
            x: centeredIndex * 0.18,
            y: 0.42,
            z: -0.92,
            yawDegrees: 0,
            pitchDegrees: -2,
            rollDegrees: 0,
            scale: 1
        )
    }
}
