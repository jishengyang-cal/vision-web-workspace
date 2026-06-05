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

struct GatewayWindow: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var kind: String
    var url: String
    var rect: GatewayRect
    var minSize: GatewaySize
    var zIndex: Int
    var focused: Bool
    var locked: Bool
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
