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

    private func appendWindow(for session: GatewaySession) {
        let index = layout.windows.count + 1
        let window = GatewayWindow(
            id: session.id,
            title: "\(session.kind.capitalized) \(index)",
            kind: session.kind,
            url: session.url,
            rect: GatewayRect(x: 80.0 + Double(index * 32), y: 96.0 + Double(index * 24), width: 360, height: 520),
            minSize: GatewaySize(width: 320, height: 240),
            zIndex: index,
            focused: true,
            locked: false
        )
        layout.windows = layout.windows.map { current in
            var copy = current
            copy.focused = false
            return copy
        } + [window]
        layout.activeWindowId = window.id
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
                rect: GatewayRect(x: 64, y: 88, width: 680, height: 420),
                minSize: GatewaySize(width: 360, height: 240),
                zIndex: 3,
                focused: true,
                locked: false
            ),
            GatewayWindow(
                id: "code",
                title: "Code",
                kind: "code",
                url: "http://127.0.0.1:8080",
                rect: GatewayRect(x: 760, y: 88, width: 620, height: 560),
                minSize: GatewaySize(width: 420, height: 300),
                zIndex: 2,
                focused: false,
                locked: false
            ),
            GatewayWindow(
                id: "browser",
                title: "Browser",
                kind: "browser",
                url: "https://developer.apple.com/visionos/",
                rect: GatewayRect(x: 112, y: 536, width: 560, height: 300),
                minSize: GatewaySize(width: 360, height: 240),
                zIndex: 1,
                focused: false,
                locked: false
            )
        ],
        activeWindowId: "terminal",
        updatedAt: ISO8601DateFormatter().string(from: Date())
    )
}
