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

    func restoreSavedLayout() {
        load()
    }

    func resetLayout() {
        layout = GatewayLayout.makeDefault(id: layout.id)
        errorMessage = nil
    }

    func open(kind: String) {
        Task {
            _ = await createWindow(kind: kind, sourceWindow: activeVisibleWindow())
        }
    }

    func openSibling(of sourceWindow: GatewayWindow) {
        Task {
            _ = await createWindow(kind: sourceWindow.kind, sourceWindow: sourceWindow)
        }
    }

    func createWindow(kind: String, sourceWindow: GatewayWindow? = nil) async -> GatewayWindow? {
        guard layout.windows.count < WorkspaceWindowDefaults.maximumWindowCount else {
            errorMessage = "Maximum 10 windows reached"
            return nil
        }

        do {
            let session = try await client.createSession(workspaceId: layout.id, kind: kind, windowId: nil)
            let window = appendWindow(for: session, sourceWindow: sourceWindow)
            errorMessage = nil
            return window
        } catch {
            errorMessage = "Session creation failed"
            return nil
        }
    }

    func openBookmark(_ bookmark: GatewayBookmark) -> GatewayWindow? {
        guard layout.windows.count < WorkspaceWindowDefaults.maximumWindowCount else {
            errorMessage = "Maximum 10 windows reached"
            return nil
        }

        let window = appendWindow(
            id: "\(bookmark.kind)-\(Int(Date().timeIntervalSince1970 * 1000))",
            title: bookmark.title,
            kind: bookmark.kind,
            url: bookmark.url,
            surfaceMode: "direct-web",
            bookmarkId: bookmark.id,
            sourceWindow: activeVisibleWindow()
        )
        errorMessage = nil
        return window
    }

    func toggleBookmark(windowId: String) {
        guard let window = layout.windows.first(where: { $0.id == windowId }) else {
            return
        }

        let now = ISO8601DateFormatter().string(from: Date())
        let existing = (layout.bookmarks ?? []).first { $0.url == window.url }

        if let existing {
            layout.bookmarks = (layout.bookmarks ?? []).filter { $0.id != existing.id }
            layout.windows = layout.windows.map { current in
                var copy = current
                if copy.bookmarkId == existing.id {
                    copy.bookmarkId = nil
                }
                return copy
            }
            touchLayout()
            return
        }

        let bookmark = GatewayBookmark(
            id: "bookmark-\(Int(Date().timeIntervalSince1970 * 1000))",
            title: window.title,
            kind: window.kind,
            url: window.url,
            createdAt: now,
            updatedAt: now
        )
        layout.bookmarks = (layout.bookmarks ?? []) + [bookmark]
        updateWindow(windowId: windowId, allowLocked: true) { current in
            current.bookmarkId = bookmark.id
        }
    }

    func navigateBack(windowId: String) {
        updateWindow(windowId: windowId, allowLocked: true) { window in
            let navigation = normalizedNavigation(for: window)
            let index = max(0, navigation.currentIndex - 1)
            window.navigation = GatewayWindowNavigation(
                entries: navigation.entries,
                currentIndex: index,
                reloadToken: navigation.reloadToken
            )
            window.url = navigation.entries[index]
        }
    }

    func navigateForward(windowId: String) {
        updateWindow(windowId: windowId, allowLocked: true) { window in
            let navigation = normalizedNavigation(for: window)
            let index = min(navigation.entries.count - 1, navigation.currentIndex + 1)
            window.navigation = GatewayWindowNavigation(
                entries: navigation.entries,
                currentIndex: index,
                reloadToken: navigation.reloadToken
            )
            window.url = navigation.entries[index]
        }
    }

    func reload(windowId: String) {
        updateWindow(windowId: windowId, allowLocked: true) { window in
            let navigation = normalizedNavigation(for: window)
            window.navigation = GatewayWindowNavigation(
                entries: navigation.entries,
                currentIndex: navigation.currentIndex,
                reloadToken: navigation.reloadToken + 1
            )
        }
    }

    func focus(windowId: String) {
        guard layout.windows.first(where: { $0.id == windowId })?.minimized != true else {
            return
        }

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
        let nextActive = topVisibleWindow()
        layout.activeWindowId = nextActive?.id
        layout.windows = layout.windows.map { current in
            var copy = current
            copy.focused = current.id == nextActive?.id
            return copy
        }
        touchLayout()
    }

    func minimize(windowId: String) {
        updateWindow(windowId: windowId, allowLocked: true) { window in
            window.minimized = true
            window.focused = false
        }

        let nextActive = topVisibleWindow()
        layout.activeWindowId = nextActive?.id
        layout.windows = layout.windows.map { current in
            var copy = current
            copy.focused = current.id == nextActive?.id
            return copy
        }
        touchLayout()
    }

    func restore(windowId: String) {
        let nextZ = (layout.windows.map(\.zIndex).max() ?? 0) + 1
        updateWindow(windowId: windowId, allowLocked: true) { window in
            window.minimized = false
            window.focused = true
            window.zIndex = nextZ
        }
        layout.activeWindowId = windowId
        layout.windows = layout.windows.map { current in
            var copy = current
            copy.focused = current.id == windowId
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

    func resize(windowId: String, widthDelta: Double = 0, heightDelta: Double = 0) {
        updateWindow(windowId: windowId) { window in
            window.rect.width = min(
                min(layout.viewport.width, WorkspaceWindowDefaults.maximumWindowWidth),
                max(window.minSize.width, window.rect.width + widthDelta)
            )
            window.rect.height = min(
                min(layout.viewport.height, WorkspaceWindowDefaults.maximumWindowHeight),
                max(window.minSize.height, window.rect.height + heightDelta)
            )
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

    private func appendWindow(for session: GatewaySession, sourceWindow: GatewayWindow?) -> GatewayWindow? {
        appendWindow(
            id: session.id,
            title: "\(session.kind.capitalized) \(layout.windows.count + 1)",
            kind: session.kind,
            url: session.url,
            surfaceMode: session.mode ?? "direct-web",
            bookmarkId: nil,
            sourceWindow: sourceWindow
        )
    }

    private func appendWindow(
        id: String,
        title: String,
        kind: String,
        url: String,
        surfaceMode: String,
        bookmarkId: String?,
        sourceWindow: GatewayWindow?
    ) -> GatewayWindow? {
        guard layout.windows.count < WorkspaceWindowDefaults.maximumWindowCount else {
            errorMessage = "Maximum 10 windows reached"
            return nil
        }

        let windowIndex = layout.windows.count
        let displayIndex = windowIndex + 1
        let now = ISO8601DateFormatter().string(from: Date())
        let placement = placementForNewWindow(sourceWindow: sourceWindow, index: windowIndex)
        let window = GatewayWindow(
            id: id,
            title: title,
            kind: kind,
            url: url,
            surfaceMode: surfaceMode,
            bookmarkId: bookmarkId,
            navigation: GatewayWindowNavigation(entries: [url], currentIndex: 0, reloadToken: 0),
            opacity: WorkspaceWindowDefaults.defaultOpacity,
            rect: placement.rect,
            pose3D: placement.pose3D,
            minSize: GatewaySize(width: 320, height: 240),
            zIndex: displayIndex,
            focused: true,
            minimized: false,
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
        return window
    }

    private func activeVisibleWindow() -> GatewayWindow? {
        guard let activeWindowId = layout.activeWindowId else {
            return topVisibleWindow()
        }

        return layout.windows.first { $0.id == activeWindowId && $0.minimized != true } ?? topVisibleWindow()
    }

    private func topVisibleWindow() -> GatewayWindow? {
        layout.windows
            .filter { $0.minimized != true }
            .max { $0.zIndex < $1.zIndex }
    }

    private func placementForNewWindow(
        sourceWindow: GatewayWindow?,
        index: Int
    ) -> (rect: GatewayRect, pose3D: GatewayWindowPose3D) {
        guard let sourceWindow else {
            let displayIndex = index + 1
            return (
                GatewayRect(x: 80.0 + Double(displayIndex * 32), y: 96.0 + Double(displayIndex * 24), width: 360, height: 520),
                WorkspaceWindowDefaults.pose3D(index: index)
            )
        }

        let leftSpace = sourceWindow.rect.x
        let rightSpace = layout.viewport.width - (sourceWindow.rect.x + sourceWindow.rect.width)
        let direction = rightSpace >= leftSpace ? 1.0 : -1.0
        let gap = 24.0
        let requestedX: Double
        if direction > 0 {
            requestedX = sourceWindow.rect.x + sourceWindow.rect.width + gap
        } else {
            requestedX = sourceWindow.rect.x - sourceWindow.rect.width - gap
        }
        let rect = GatewayRect(
            x: min(max(0, requestedX), max(0, layout.viewport.width - sourceWindow.rect.width)),
            y: min(max(0, sourceWindow.rect.y), max(0, layout.viewport.height - sourceWindow.rect.height)),
            width: sourceWindow.rect.width,
            height: sourceWindow.rect.height
        )
        let poseGap = max(0.62, 0.72 * sourceWindow.pose3D.scale)
        var pose = sourceWindow.pose3D
        pose.x = sourceWindow.pose3D.x + direction * poseGap

        return (rect, pose)
    }

    private func touchLayout() {
        layout.updatedAt = ISO8601DateFormatter().string(from: Date())
    }

    private func normalizedNavigation(for window: GatewayWindow) -> GatewayWindowNavigation {
        guard let navigation = window.navigation, !navigation.entries.isEmpty else {
            return GatewayWindowNavigation(entries: [window.url], currentIndex: 0, reloadToken: 0)
        }

        let currentIndex = min(max(0, navigation.currentIndex), navigation.entries.count - 1)
        if navigation.entries[currentIndex] == window.url {
            return GatewayWindowNavigation(
                entries: navigation.entries,
                currentIndex: currentIndex,
                reloadToken: navigation.reloadToken
            )
        }

        var entries = Array(navigation.entries.prefix(currentIndex + 1))
        entries.append(window.url)
        return GatewayWindowNavigation(
            entries: entries,
            currentIndex: entries.count - 1,
            reloadToken: navigation.reloadToken
        )
    }
}

extension GatewayLayout {
    static var `default`: GatewayLayout {
        makeDefault()
    }

    static func makeDefault(id: String = "local-dev-workspace") -> GatewayLayout {
        let now = ISO8601DateFormatter().string(from: Date())

        return GatewayLayout(
            id: id,
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
                navigation: GatewayWindowNavigation(entries: ["http://127.0.0.1:7681"], currentIndex: 0, reloadToken: 0),
                opacity: WorkspaceWindowDefaults.defaultOpacity,
                rect: GatewayRect(x: 64, y: 88, width: 680, height: 420),
                pose3D: WorkspaceWindowDefaults.pose3D(index: 0),
                minSize: GatewaySize(width: 360, height: 240),
                zIndex: 3,
                focused: true,
                minimized: false,
                locked: false,
                lockMode: "screen-locked",
                clipboardPolicy: "platform-default",
                createdAt: now,
                updatedAt: now
            ),
            GatewayWindow(
                id: "code",
                title: "Code",
                kind: "code",
                url: "http://127.0.0.1:8080",
                surfaceMode: "direct-web",
                bookmarkId: nil,
                navigation: GatewayWindowNavigation(entries: ["http://127.0.0.1:8080"], currentIndex: 0, reloadToken: 0),
                opacity: WorkspaceWindowDefaults.defaultOpacity,
                rect: GatewayRect(x: 760, y: 88, width: 620, height: 560),
                pose3D: WorkspaceWindowDefaults.pose3D(index: 1),
                minSize: GatewaySize(width: 420, height: 300),
                zIndex: 2,
                focused: false,
                minimized: false,
                locked: false,
                lockMode: "screen-locked",
                clipboardPolicy: "platform-default",
                createdAt: now,
                updatedAt: now
            ),
            GatewayWindow(
                id: "browser",
                title: "Browser",
                kind: "browser",
                url: "https://developer.apple.com/visionos/",
                surfaceMode: "direct-web",
                bookmarkId: nil,
                navigation: GatewayWindowNavigation(entries: ["https://developer.apple.com/visionos/"], currentIndex: 0, reloadToken: 0),
                opacity: WorkspaceWindowDefaults.defaultOpacity,
                rect: GatewayRect(x: 112, y: 536, width: 560, height: 300),
                pose3D: WorkspaceWindowDefaults.pose3D(index: 2),
                minSize: GatewaySize(width: 360, height: 240),
                zIndex: 1,
                focused: false,
                minimized: false,
                locked: false,
                lockMode: "screen-locked",
                clipboardPolicy: "platform-default",
                createdAt: now,
                updatedAt: now
            )
            ],
            bookmarks: [],
            activeWindowId: "terminal",
            updatedAt: now
        )
    }
}
