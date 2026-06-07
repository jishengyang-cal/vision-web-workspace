import Foundation

struct WaterLoungeSceneSpec: Decodable {
    struct Room: Decodable {
        let width: Float
        let depth: Float
        let height: Float
    }

    struct Water: Decodable {
        let height: Float
        let surfaceY: Float
    }

    struct Platform: Decodable {
        let width: Float
        let depth: Float
        let height: Float
        let centerZ: Float
    }

    struct Bridge: Decodable {
        let count: Int
        let slabWidth: Float
        let slabDepth: Float
        let slabHeight: Float
        let gap: Float
        let startZ: Float
    }

    struct Lighting: Decodable {
        let ceilingHeight: Float
        let sideLightWidth: Float
        let sideLightDepth: Float
        let backWallLightWidth: Float
        let backWallLightHeight: Float
    }

    struct Furniture: Decodable {
        let sofaWidth: Float
        let sofaDepth: Float
        let sofaHeight: Float
        let tableWidth: Float
        let tableDepth: Float
        let tableHeight: Float
    }

    struct Caustics: Decodable {
        let wallRows: Int
        let wallColumns: Int
        let sideRows: Int
        let sideColumns: Int
        let platformCount: Int
        let bridgeIntensity: Float
    }

    let room: Room
    let water: Water
    let platform: Platform
    let bridge: Bridge
    let lighting: Lighting
    let furniture: Furniture
    let caustics: Caustics

    static func load() -> WaterLoungeSceneSpec {
        guard let url = Bundle.main.url(forResource: "WaterLoungeSceneSpec", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let spec = try? JSONDecoder().decode(WaterLoungeSceneSpec.self, from: data) else {
            return fallback
        }

        return spec
    }

    static let fallback = WaterLoungeSceneSpec(
        room: Room(width: 13.6, depth: 11.4, height: 4.8),
        water: Water(height: 0.04, surfaceY: 0.08),
        platform: Platform(width: 6.4, depth: 6.4, height: 0.16, centerZ: -1.05),
        bridge: Bridge(count: 11, slabWidth: 1.35, slabDepth: 0.28, slabHeight: 0.08, gap: 0.18, startZ: 4.55),
        lighting: Lighting(ceilingHeight: 4.74, sideLightWidth: 4.2, sideLightDepth: 0.55, backWallLightWidth: 5.0, backWallLightHeight: 0.48),
        furniture: Furniture(sofaWidth: 1.12, sofaDepth: 0.82, sofaHeight: 0.62, tableWidth: 1.95, tableDepth: 0.72, tableHeight: 0.42),
        caustics: Caustics(wallRows: 5, wallColumns: 12, sideRows: 5, sideColumns: 8, platformCount: 34, bridgeIntensity: 0.7)
    )
}
