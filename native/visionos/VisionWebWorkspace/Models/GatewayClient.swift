import Foundation
import SwiftUI

enum GatewayClientError: Error {
    case invalidResponse
}

final class GatewayClient {
    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(baseURL: URL = URL(string: "http://127.0.0.1:3001")!, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func fetchLayout(workspaceId: String) async throws -> GatewayLayout {
        let url = baseURL.appendingPathComponent("workspaces").appendingPathComponent(workspaceId).appendingPathComponent("layout")
        let (data, response) = try await session.data(from: url)
        try validate(response)
        return try decoder.decode(GatewayLayoutResponse.self, from: data).layout
    }

    func saveLayout(_ layout: GatewayLayout) async throws -> GatewayLayout {
        let url = baseURL.appendingPathComponent("workspaces").appendingPathComponent(layout.id).appendingPathComponent("layout")
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try encoder.encode(GatewaySaveLayoutRequest(layout: layout))

        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try decoder.decode(GatewayLayoutResponse.self, from: data).layout
    }

    func createSession(workspaceId: String, kind: String, windowId: String?) async throws -> GatewaySession {
        let url = baseURL.appendingPathComponent("sessions")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try encoder.encode(
            GatewayCreateSessionRequest(
                workspaceId: workspaceId,
                kind: kind,
                windowId: windowId,
                targetLabel: nil,
                requestedUrl: nil
            )
        )

        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try decoder.decode(GatewayCreateSessionResponse.self, from: data).session
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw GatewayClientError.invalidResponse
        }
    }
}

@MainActor
final class WorkspaceStore: ObservableObject {
    @Published var layout: GatewayLayout
    @Published var errorMessage: String?

    private let client = GatewayClient()

    init() {
        self.layout = GatewayLayout.default
    }

    func binding(for window: GatewayWindow) -> Binding<GatewayWindow> {
        Binding(
            get: {
                self.layout.windows.first(where: { $0.id == window.id }) ?? window
            },
            set: { updated in
                guard let index = self.layout.windows.firstIndex(where: { $0.id == updated.id }) else {
                    return
                }
                self.layout.windows[index] = updated
                self.layout.updatedAt = ISO8601DateFormatter().string(from: Date())
            }
        )
    }

    func load() {
        Task {
            do {
                layout = try await client.fetchLayout(workspaceId: layout.id)
                errorMessage = nil
            } catch {
                errorMessage = "Gateway unavailable"
            }
        }
    }

    func save() {
        Task {
            do {
                layout = try await client.saveLayout(layout)
                errorMessage = nil
            } catch {
                errorMessage = "Layout save failed"
            }
        }
    }

    func open(kind: String) {
        guard layout.windows.count < WorkspaceWindowDefaults.maximumWindowCount else {
            errorMessage = "Maximum 10 windows reached"
            return
        }

        Task {
            do {
                let session = try await client.createSession(workspaceId: layout.id, kind: kind, windowId: nil)
                appendWindow(for: session)
                errorMessage = nil
            } catch {
                errorMessage = "Session creation failed"
            }
        }
    }

    func focus(windowId: String) {
        let nextZ = (layout.windows.map(\.zIndex).max() ?? 0) + 1
        layout.windows = layout.windows.map { current in
            var copy = current
            copy.focused = current.id == windowId
            if current.id == windowId {
                copy.zIndex = nextZ
            }
            return copy
        }
        layout.activeWindowId = windowId
        touchLayout()
    }

    func close(windowId: String) {
        layout.windows.removeAll { $0.id == windowId }
        let nextActive = layout.windows.max { $0.zIndex < $1.zIndex }
        layout.activeWindowId = nextActive?.id
        layout.windows = layout.windows.map { current in
            var copy = current
            copy.focused = current.id == nextActive?.id
            return copy
        }
        touchLayout()
    }

    func setOpacity(windowId: String, opacity: Double) {
        updateWindow(windowId: windowId, allowLocked: true) { window in
            window.opacity = min(
                WorkspaceWindowDefaults.maximumOpacity,
                max(WorkspaceWindowDefaults.minimumOpacity, opacity)
            )
        }
    }

    func setLockMode(windowId: String, lockMode: String) {
        updateWindow(windowId: windowId, allowLocked: true) { window in
            window.lockMode = lockMode
        }
    }

    func toggleEditLock(windowId: String) {
        updateWindow(windowId: windowId, allowLocked: true) { window in
            window.locked.toggle()
        }
    }

    func move(windowId: String, deltaX: Double, deltaY: Double) {
        updateWindow(windowId: windowId) { window in
            window.pose3D.x += deltaX
            window.pose3D.y += deltaY
        }
    }

    func scale(windowId: String, delta: Double) {
        updateWindow(windowId: windowId) { window in
            window.pose3D.scale = min(1.6, max(0.55, window.pose3D.scale + delta))
        }
    }

    func rotate(windowId: String, yawDelta: Double = 0, pitchDelta: Double = 0, rollDelta: Double = 0) {
        updateWindow(windowId: windowId) { window in
            window.pose3D.yawDegrees += yawDelta
            window.pose3D.pitchDegrees += pitchDelta
            window.pose3D.rollDegrees += rollDelta
        }
    }

    func moveDepth(windowId: String, delta: Double) {
        updateWindow(windowId: windowId) { window in
            window.pose3D.z = min(-0.75, max(-2.2, window.pose3D.z + delta))
        }
    }

    private func updateWindow(
        windowId: String,
        allowLocked: Bool = false,
        update: (inout GatewayWindow) -> Void
    ) {
        guard let index = layout.windows.firstIndex(where: { $0.id == windowId }) else {
            return
        }

        guard allowLocked || !layout.windows[index].locked else {
            return
        }

        update(&layout.windows[index])
        layout.windows[index].updatedAt = ISO8601DateFormatter().string(from: Date())
        touchLayout()
    }

    private func appendWindow(for session: GatewaySession) {
        guard layout.windows.count < WorkspaceWindowDefaults.maximumWindowCount else {
            errorMessage = "Maximum 10 windows reached"
            return
        }

        let windowIndex = layout.windows.count
        let displayIndex = windowIndex + 1
        let now = ISO8601DateFormatter().string(from: Date())
        let window = GatewayWindow(
            id: session.id,
            title: "\(session.kind.capitalized) \(displayIndex)",
            kind: session.kind,
            url: session.url,
            surfaceMode: session.mode ?? "direct-web",
            bookmarkId: nil,
            opacity: WorkspaceWindowDefaults.defaultOpacity,
            rect: GatewayRect(x: 80.0 + Double(displayIndex * 32), y: 96.0 + Double(displayIndex * 24), width: 360, height: 520),
            pose3D: WorkspaceWindowDefaults.pose3D(index: windowIndex),
            minSize: GatewaySize(width: 320, height: 240),
            zIndex: displayIndex,
            focused: true,
            locked: false,
            lockMode: "screen-locked",
            clipboardPolicy: "platform-default",
            createdAt: now,
            updatedAt: now
        )
        layout.windows = layout.windows.map { current in
            var copy = current
            copy.focused = false
            return copy
        } + [window]
        layout.activeWindowId = window.id
        touchLayout()
    }

    private func touchLayout() {
        layout.updatedAt = ISO8601DateFormatter().string(from: Date())
    }
}

extension GatewayLayout {
    static let `default` = GatewayLayout(
        id: "local-dev-workspace",
        name: "Local Dev Workspace",
        pose: GatewayPose(mode: "head-locked", distanceMeters: 1.25, yawDegrees: 0, pitchDegrees: -2, rollDegrees: 0, smoothing: 0.18),
        viewport: GatewaySize(width: 1440, height: 900),
        windows: [
            GatewayWindow(
                id: "terminal",
                title: "Terminal",
                kind: "terminal",
                url: "http://127.0.0.1:7681",
                surfaceMode: "direct-web",
                bookmarkId: nil,
                opacity: WorkspaceWindowDefaults.defaultOpacity,
                rect: GatewayRect(x: 64, y: 88, width: 680, height: 420),
                pose3D: WorkspaceWindowDefaults.pose3D(index: 0),
                minSize: GatewaySize(width: 360, height: 240),
                zIndex: 3,
                focused: true,
                locked: false,
                lockMode: "screen-locked",
                clipboardPolicy: "platform-default",
                createdAt: ISO8601DateFormatter().string(from: Date()),
                updatedAt: ISO8601DateFormatter().string(from: Date())
            ),
            GatewayWindow(
                id: "code",
                title: "Code",
                kind: "code",
                url: "http://127.0.0.1:8080",
                surfaceMode: "direct-web",
                bookmarkId: nil,
                opacity: WorkspaceWindowDefaults.defaultOpacity,
                rect: GatewayRect(x: 760, y: 88, width: 620, height: 560),
                pose3D: WorkspaceWindowDefaults.pose3D(index: 1),
                minSize: GatewaySize(width: 420, height: 300),
                zIndex: 2,
                focused: false,
                locked: false,
                lockMode: "screen-locked",
                clipboardPolicy: "platform-default",
                createdAt: ISO8601DateFormatter().string(from: Date()),
                updatedAt: ISO8601DateFormatter().string(from: Date())
            ),
            GatewayWindow(
                id: "browser",
                title: "Browser",
                kind: "browser",
                url: "https://developer.apple.com/visionos/",
                surfaceMode: "direct-web",
                bookmarkId: nil,
                opacity: WorkspaceWindowDefaults.defaultOpacity,
                rect: GatewayRect(x: 112, y: 536, width: 560, height: 300),
                pose3D: WorkspaceWindowDefaults.pose3D(index: 2),
                minSize: GatewaySize(width: 360, height: 240),
                zIndex: 1,
                focused: false,
                locked: false,
                lockMode: "screen-locked",
                clipboardPolicy: "platform-default",
                createdAt: ISO8601DateFormatter().string(from: Date()),
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )
        ],
        activeWindowId: "terminal",
        updatedAt: ISO8601DateFormatter().string(from: Date())
    )
}
