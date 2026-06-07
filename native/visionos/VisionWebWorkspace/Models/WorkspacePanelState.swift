import Foundation

enum WorkspaceConstants {
    static let nativeWebWindowGroupID = "NativeRemoteWebWindow"
    static let immersiveSpaceID = "WorkspaceImmersiveSpace"
    static let officeEnvironmentSpaceID = "OfficeEnvironmentSpace"
    static let loungeEnvironmentSpaceID = "LoungeEnvironmentSpace"
    static let rootEntityName = "HeadLockedWorkspaceRoot"
    static let menuAttachmentID = "workspace-menu"
    static let menuEntityName = "WorkspaceMenu"
    static let panelAttachmentID = "workspace-panel"
    static let panelEntityName = "WorkspacePanel"
    static let windowAttachmentPrefix = "workspace-window-"
    static let windowEntityPrefix = "RemoteWindow:"

    static func windowAttachmentID(_ windowID: String) -> String {
        "\(windowAttachmentPrefix)\(windowID)"
    }

    static func windowEntityName(_ windowID: String) -> String {
        "\(windowEntityPrefix)\(windowID)"
    }
}

enum ImmersiveEnvironmentKind: String, CaseIterable, Identifiable {
    case office
    case lounge

    var id: String { rawValue }

    var title: String {
        switch self {
        case .office:
            "Office"
        case .lounge:
            "Water Lounge"
        }
    }
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
