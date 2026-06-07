import Foundation

struct OfficeSceneSpec: Decodable {
    struct Room: Decodable {
        let width: Float
        let depth: Float
        let height: Float
    }

    struct DeskGrid: Decodable {
        let xPositions: [Float]
        let zPositions: [Float]
    }

    struct Desk: Decodable {
        let width: Float
        let depth: Float
        let topThickness: Float
        let topHeight: Float
        let baseWidth: Float
        let baseDepth: Float
        let baseHeight: Float
    }

    struct Column: Decodable {
        let xPositions: [Float]
        let zPositions: [Float]
        let width: Float
        let depth: Float
    }

    struct Runway: Decodable {
        let redWidth: Float
        let whiteWidth: Float
        let whiteOffset: Float
        let length: Float
    }

    struct Lighting: Decodable {
        let lampHeight: Float
        let shadeWidth: Float
        let shadeDepth: Float
        let underDeskGlowWidth: Float
        let underDeskGlowDepth: Float
        let columnGlowWidth: Float
    }

    struct Props: Decodable {
        let includeOperators: Bool
        let includeCoatRacks: Bool
        let typewriterWidth: Float
        let paperWidth: Float
    }

    let room: Room
    let deskGrid: DeskGrid
    let desk: Desk
    let column: Column
    let runway: Runway
    let lighting: Lighting
    let props: Props

    static func load() -> OfficeSceneSpec {
        guard let url = Bundle.main.url(forResource: "OfficeSceneSpec", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let spec = try? JSONDecoder().decode(OfficeSceneSpec.self, from: data) else {
            return fallback
        }

        return spec
    }

    static let fallback = OfficeSceneSpec(
        room: Room(width: 12.8, depth: 10.6, height: 4.7),
        deskGrid: DeskGrid(
            xPositions: [-3.85, -1.72, 1.72, 3.85],
            zPositions: [-3.45, -1.65, 0.15, 1.95]
        ),
        desk: Desk(width: 1.58, depth: 0.9, topThickness: 0.08, topHeight: 0.72, baseWidth: 1.18, baseDepth: 0.66, baseHeight: 0.62),
        column: Column(xPositions: [-4.75, 4.75], zPositions: [-2.65, 1.35], width: 0.72, depth: 0.72),
        runway: Runway(redWidth: 0.18, whiteWidth: 0.055, whiteOffset: 0.17, length: 9.6),
        lighting: Lighting(lampHeight: 1.08, shadeWidth: 0.48, shadeDepth: 0.48, underDeskGlowWidth: 1.46, underDeskGlowDepth: 0.92, columnGlowWidth: 0.78),
        props: Props(includeOperators: true, includeCoatRacks: true, typewriterWidth: 0.42, paperWidth: 0.34)
    )
}
