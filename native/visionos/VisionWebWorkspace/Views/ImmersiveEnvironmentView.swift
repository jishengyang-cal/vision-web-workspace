import RealityKit
import SwiftUI

struct ImmersiveEnvironmentView: View {
    let kind: ImmersiveEnvironmentKind

    @State private var panelState = WorkspacePanelState(
        distanceMeters: 1.15,
        horizontalOffsetMeters: 0,
        verticalOffsetMeters: 1.45,
        scale: 0.82
    )
    @State private var rootEntity = Entity()
    @State private var animationBaselines: [String: SIMD3<Float>] = [:]

    var body: some View {
        TimelineView(.animation) { timeline in
            RealityView { content, attachments in
                rootEntity = ImmersiveEnvironmentSceneFactory.make(kind: kind)
                animationBaselines.removeAll()
                content.add(rootEntity)

                if let panel = attachments.entity(for: WorkspaceConstants.panelAttachmentID) {
                    attach(panel)
                }
            } update: { _, attachments in
                let time = Float(timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 4_096))
                ImmersiveEnvironmentSceneFactory.update(rootEntity, time: time, baselines: &animationBaselines)

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
    }

    private func attach(_ panel: Entity) {
        panel.name = WorkspaceConstants.panelEntityName
        panel.position = [
            panelState.horizontalOffsetMeters,
            panelState.verticalOffsetMeters,
            -panelState.distanceMeters
        ]
        panel.scale = SIMD3<Float>(repeating: panelState.scale)

        if panel.parent == nil {
            rootEntity.addChild(panel)
        }
    }
}
