import Foundation

struct GatewayRect: Codable, Equatable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double
}

struct GatewaySize: Codable, Equatable {
    var width: Double
    var height: Double
}

struct GatewayPose: Codable, Equatable {
    var mode: String
    var distanceMeters: Double
    var yawDegrees: Double
    var pitchDegrees: Double
    var rollDegrees: Double
    var smoothing: Double
}

struct GatewayWindowPose3D: Codable, Equatable {
    var x: Double
    var y: Double
    var z: Double
    var yawDegrees: Double
    var pitchDegrees: Double
    var rollDegrees: Double
    var scale: Double
}

struct GatewayWindow: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var kind: String
    var url: String
    var surfaceMode: String
    var bookmarkId: String?
    var opacity: Double
    var rect: GatewayRect
    var pose3D: GatewayWindowPose3D
    var minSize: GatewaySize
    var zIndex: Int
    var focused: Bool
    var minimized: Bool?
    var locked: Bool
    var lockMode: String
    var clipboardPolicy: String
    var createdAt: String?
    var updatedAt: String?
}

struct GatewayLayout: Codable, Equatable {
    var id: String
    var name: String
    var pose: GatewayPose
    var viewport: GatewaySize
    var windows: [GatewayWindow]
    var activeWindowId: String?
    var updatedAt: String
}

struct GatewayLayoutResponse: Codable {
    var layout: GatewayLayout
}

struct GatewaySaveLayoutRequest: Codable {
    var layout: GatewayLayout
}

struct GatewayCreateSessionRequest: Codable {
    var workspaceId: String
    var kind: String
    var windowId: String?
    var targetLabel: String?
    var requestedUrl: String?
}

struct GatewayCreateSessionResponse: Codable {
    var session: GatewaySession
}

struct GatewaySession: Codable, Identifiable {
    var id: String
    var kind: String
    var workspaceId: String
    var url: String
    var expiresAt: String
    var targetLabel: String?
    var auditLevel: String?
    var mode: String?
}

enum WorkspaceWindowDefaults {
    static let maximumWindowCount = 10
    static let minimumOpacity = 0.25
    static let maximumOpacity = 1.0
    static let defaultOpacity = 0.92

    static func pose3D(index: Int) -> GatewayWindowPose3D {
        let column = index % 3
        let row = index / 3

        return GatewayWindowPose3D(
            x: Double(column - 1) * 0.72,
            y: 0.16 - Double(row) * 0.46,
            z: -1.25,
            yawDegrees: Double(column - 1) * -7,
            pitchDegrees: -2,
            rollDegrees: 0,
            scale: 1
        )
    }
}
