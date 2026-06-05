import Foundation

enum WorkspaceConstants {
    static let immersiveSpaceID = "WorkspaceImmersiveSpace"
    static let rootEntityName = "HeadLockedWorkspaceRoot"
    static let panelAttachmentID = "workspace-panel"
    static let panelEntityName = "WorkspacePanel"
}

struct WorkspacePanelState: Equatable {
    var distanceMeters: Float
    var horizontalOffsetMeters: Float
    var verticalOffsetMeters: Float
    var scale: Float

    static let `default` = WorkspacePanelState(
        distanceMeters: 1.25,
        horizontalOffsetMeters: 0,
        verticalOffsetMeters: 1.35,
        scale: 1
    )
}
