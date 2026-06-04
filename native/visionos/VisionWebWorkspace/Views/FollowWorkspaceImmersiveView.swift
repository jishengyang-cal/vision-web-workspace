import RealityKit
import SwiftUI

struct FollowWorkspaceImmersiveView: View {
    @State private var panelState = WorkspacePanelState.default
    @State private var rootEntity = Entity()

    var body: some View {
        RealityView { content, attachments in
            rootEntity.name = WorkspaceConstants.rootEntityName
            updateRootPose()
            content.add(rootEntity)

            if let panel = attachments.entity(for: WorkspaceConstants.panelAttachmentID) {
                attach(panel)
            }
        } update: { _, attachments in
            updateRootPose()

            if let panel = attachments.entity(for: WorkspaceConstants.panelAttachmentID) {
                attach(panel)
            }
        } attachments: {
            Attachment(id: WorkspaceConstants.panelAttachmentID) {
                WorkspacePanelView(panelState: $panelState)
                    .frame(width: 1200, height: 760)
            }
        }
    }

    private func updateRootPose() {
        rootEntity.position = [
            panelState.horizontalOffsetMeters,
            panelState.verticalOffsetMeters,
            -panelState.distanceMeters
        ]
    }

    private func attach(_ panel: Entity) {
        panel.name = WorkspaceConstants.panelEntityName
        panel.position = .zero
        panel.scale = SIMD3<Float>(repeating: panelState.scale)

        if panel.parent == nil {
            rootEntity.addChild(panel)
        }
    }
}
