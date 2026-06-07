import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

struct SpatialRemoteWebWindowView: View {
    @Binding var window: GatewayWindow
    let focus: () -> Void
    let newWindow: () -> Void
    let minimize: () -> Void
    let restore: () -> Void
    let close: () -> Void

    @State private var address = ""
    @State private var dragStartPose: GatewayWindowPose3D?

    var body: some View {
        Group {
            if window.minimized == true {
                minimizedBubble
            } else {
                fullWindow
            }
        }
        .onAppear {
            address = window.url
        }
        .onChange(of: window.url) { _, newValue in
            address = newValue
        }
    }

    private var fullWindow: some View {
        VStack(spacing: 0) {
            titlebar

            HStack(spacing: 8) {
                TextField("URL", text: $address)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit(loadAddress)

                Button("Go") {
                    loadAddress()
                }

                Button("Copy URL") {
                    copyURL()
                }
            }
            .padding(10)

            controls

            WebSurfaceView(urlString: window.url)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: CGFloat(window.rect.width), height: CGFloat(window.rect.height))
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .glassBackgroundEffect()
        .opacity(window.opacity)
        .onTapGesture {
            focus()
        }
    }

    private var minimizedBubble: some View {
        Button {
            restore()
        } label: {
            HStack(spacing: 8) {
                Circle()
                    .fill(kindColor)
                    .frame(width: 12, height: 12)

                Text(window.title)
                    .font(.caption)
                    .lineLimit(1)
            }
            .frame(width: 112, height: 44)
            .background(.regularMaterial)
            .clipShape(Capsule())
            .glassBackgroundEffect()
        }
        .buttonStyle(.plain)
    }

    private var titlebar: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(kindColor)
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 2) {
                Text(window.title)
                    .font(.headline)
                    .lineLimit(1)
                Text(window.lockMode)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            HStack(spacing: 6) {
                Button("+") {
                    newWindow()
                }

                Button("-") {
                    minimize()
                }

                Button("x") {
                    close()
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.thinMaterial)
        .contentShape(Rectangle())
        .gesture(moveGesture)
    }

    private var controls: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Text("Opacity")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 56, alignment: .leading)

                Slider(
                    value: Binding(
                        get: { window.opacity },
                        set: {
                            window.opacity = min(
                                WorkspaceWindowDefaults.maximumOpacity,
                                max(WorkspaceWindowDefaults.minimumOpacity, $0)
                            )
                            touchWindow()
                        }
                    ),
                    in: WorkspaceWindowDefaults.minimumOpacity...WorkspaceWindowDefaults.maximumOpacity,
                    step: 0.05
                )
            }

            HStack(spacing: 8) {
                Button(window.locked ? "Unlock" : "Lock") {
                    window.locked.toggle()
                    touchWindow()
                }
                Button("Scale -") {
                    adjustScale(-0.05)
                }
                Button("Scale +") {
                    adjustScale(0.05)
                }
                Button("Yaw -") {
                    adjustYaw(-4)
                }
                Button("Yaw +") {
                    adjustYaw(4)
                }
                Button("Pitch -") {
                    adjustPitch(-3)
                }
                Button("Pitch +") {
                    adjustPitch(3)
                }
                Button("Near") {
                    adjustDepth(0.08)
                }
                Button("Far") {
                    adjustDepth(-0.08)
                }
            }
            .font(.caption)
        }
        .padding(.horizontal, 10)
        .padding(.bottom, 10)
    }

    private var moveGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                guard !window.locked else {
                    return
                }

                if dragStartPose == nil {
                    dragStartPose = window.pose3D
                    focus()
                }

                guard let start = dragStartPose else {
                    return
                }

                window.pose3D.x = start.x + Double(value.translation.width) * 0.0014
                window.pose3D.y = start.y - Double(value.translation.height) * 0.0014
                touchWindow()
            }
            .onEnded { _ in
                dragStartPose = nil
            }
    }

    private var kindColor: Color {
        switch window.kind {
        case "terminal":
            .green
        case "code":
            .blue
        case "browser":
            .orange
        case "docs":
            .purple
        case "logs":
            .red
        default:
            .gray
        }
    }

    private func loadAddress() {
        window.url = normalizedAddress(address)
        touchWindow()
    }

    private func normalizedAddress(_ rawValue: String) -> String {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return trimmed
        }
        return "https://\(trimmed)"
    }

    private func adjustScale(_ delta: Double) {
        guard !window.locked else {
            return
        }

        window.pose3D.scale = min(1.6, max(0.55, window.pose3D.scale + delta))
        touchWindow()
    }

    private func adjustYaw(_ delta: Double) {
        guard !window.locked else {
            return
        }

        window.pose3D.yawDegrees += delta
        touchWindow()
    }

    private func adjustPitch(_ delta: Double) {
        guard !window.locked else {
            return
        }

        window.pose3D.pitchDegrees += delta
        touchWindow()
    }

    private func adjustDepth(_ delta: Double) {
        guard !window.locked else {
            return
        }

        window.pose3D.z = min(-0.75, max(-2.2, window.pose3D.z + delta))
        touchWindow()
    }

    private func touchWindow() {
        window.updatedAt = ISO8601DateFormatter().string(from: Date())
    }

    private func copyURL() {
        #if canImport(UIKit)
        UIPasteboard.general.string = window.url
        #endif
    }
}

#Preview {
    SpatialRemoteWebWindowView(
        window: .constant(GatewayLayout.default.windows[0]),
        focus: {},
        newWindow: {},
        minimize: {},
        restore: {},
        close: {}
    )
}
