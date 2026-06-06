import RealityKit
import UIKit

enum ImmersiveEnvironmentSceneFactory {
    static func make(kind: ImmersiveEnvironmentKind) -> Entity {
        let root = Entity()
        root.name = "ImmersiveEnvironmentRoot-\(kind.rawValue)"

        switch kind {
        case .office:
            buildOffice(in: root)
        case .lounge:
            buildLounge(in: root)
        }

        return root
    }

    private static func buildOffice(in root: Entity) {
        addRoomShell(
            to: root,
            width: 10.0,
            depth: 9.0,
            height: 4.2,
            floorMaterial: glossyDarkFloor(),
            wallMaterial: darkWall(),
            ceilingMaterial: darkWall()
        )

        addOfficeColumns(to: root)
        addOfficeDeskGrid(to: root)
        addCenterRunway(to: root)
        addWorkspaceAnchorDesk(to: root, position: [0, 0.44, -1.8])
    }

    private static func buildLounge(in root: Entity) {
        addRoomShell(
            to: root,
            width: 11.5,
            depth: 8.5,
            height: 4.6,
            floorMaterial: warmStone(),
            wallMaterial: goldStone(),
            ceilingMaterial: bronzeCeiling()
        )

        addWaterPool(to: root)
        addMeetingPlatform(to: root)
        addLoungeFurniture(to: root)
        addWaterCaustics(to: root)
        addCeilingLightWells(to: root)
    }

    private static func addRoomShell(
        to root: Entity,
        width: Float,
        depth: Float,
        height: Float,
        floorMaterial: any Material,
        wallMaterial: any Material,
        ceilingMaterial: any Material
    ) {
        addBox(to: root, name: "floor", size: [width, 0.05, depth], position: [0, 0, 0], material: floorMaterial)
        addBox(to: root, name: "ceiling", size: [width, 0.05, depth], position: [0, height, 0], material: ceilingMaterial)
        addBox(to: root, name: "back-wall", size: [width, height, 0.05], position: [0, height / 2, -depth / 2], material: wallMaterial)
        addBox(to: root, name: "front-threshold", size: [width, height, 0.05], position: [0, height / 2, depth / 2], material: wallMaterial)
        addBox(to: root, name: "left-wall", size: [0.05, height, depth], position: [-width / 2, height / 2, 0], material: wallMaterial)
        addBox(to: root, name: "right-wall", size: [0.05, height, depth], position: [width / 2, height / 2, 0], material: wallMaterial)
    }

    private static func addOfficeColumns(to root: Entity) {
        for x in [-3.6, 3.6] as [Float] {
            addBox(to: root, name: "concrete-column", size: [0.58, 4.1, 0.58], position: [x, 2.05, -2.2], material: concrete())
            addBox(to: root, name: "concrete-column", size: [0.58, 4.1, 0.58], position: [x, 2.05, 1.65], material: concrete())
        }
    }

    private static func addOfficeDeskGrid(to root: Entity) {
        let xPositions: [Float] = [-3.0, 0.0, 3.0]
        let zPositions: [Float] = [-3.1, -1.2, 0.7, 2.6]

        for z in zPositions {
            for x in xPositions {
                addOfficeDesk(to: root, position: [x, 0.43, z])
            }
        }
    }

    private static func addOfficeDesk(to root: Entity, position: SIMD3<Float>) {
        addBox(to: root, name: "office-desk-top", size: [1.45, 0.08, 0.86], position: position, material: blackGloss())
        addBox(to: root, name: "office-desk-base", size: [0.58, 0.7, 0.65], position: [position.x, 0.08, position.z], material: blackDeskBase())
        addBox(to: root, name: "office-chair", size: [0.5, 0.52, 0.48], position: [position.x, 0.28, position.z + 0.66], material: leather())
        addBox(to: root, name: "desk-lamp-stem", size: [0.04, 0.54, 0.04], position: [position.x + 0.48, 0.76, position.z - 0.18], material: chrome())
        addBox(to: root, name: "desk-lamp-shade", size: [0.46, 0.08, 0.46], position: [position.x + 0.48, 1.05, position.z - 0.18], material: coolLight())
        addBox(to: root, name: "terminal-prop", size: [0.42, 0.12, 0.28], position: [position.x - 0.22, 0.54, position.z - 0.08], material: grayMachine())
        addBox(to: root, name: "paper-stack", size: [0.34, 0.025, 0.24], position: [position.x + 0.12, 0.51, position.z + 0.22], material: paper())
    }

    private static func addCenterRunway(to root: Entity) {
        addBox(to: root, name: "runway-red", size: [0.16, 0.012, 8.0], position: [0, 0.04, -0.2], material: redAccent())
        addBox(to: root, name: "runway-white-left", size: [0.04, 0.014, 8.0], position: [-0.14, 0.045, -0.2], material: paper())
        addBox(to: root, name: "runway-white-right", size: [0.04, 0.014, 8.0], position: [0.14, 0.045, -0.2], material: paper())
    }

    private static func addWorkspaceAnchorDesk(to root: Entity, position: SIMD3<Float>) {
        addBox(to: root, name: "workspace-anchor-table", size: [2.2, 0.1, 0.7], position: position, material: blackGloss())
        addBox(to: root, name: "workspace-anchor-base", size: [0.72, 0.75, 0.52], position: [position.x, 0.1, position.z], material: blackDeskBase())
    }

    private static func addWaterPool(to root: Entity) {
        addBox(to: root, name: "water-pool", size: [11.3, 0.035, 8.2], position: [0, 0.09, 0], material: water())
        addBox(to: root, name: "walkway-slat-1", size: [1.85, 0.06, 0.22], position: [0, 0.18, 3.25], material: warmStone())
        addBox(to: root, name: "walkway-slat-2", size: [1.85, 0.06, 0.22], position: [0, 0.18, 2.78], material: warmStone())
        addBox(to: root, name: "walkway-slat-3", size: [1.85, 0.06, 0.22], position: [0, 0.18, 2.31], material: warmStone())
        addBox(to: root, name: "walkway-slat-4", size: [1.85, 0.06, 0.22], position: [0, 0.18, 1.84], material: warmStone())
    }

    private static func addMeetingPlatform(to root: Entity) {
        addBox(to: root, name: "meeting-platform", size: [6.8, 0.12, 4.2], position: [0, 0.2, -0.65], material: warmStone())
        addBox(to: root, name: "meeting-table", size: [2.1, 0.12, 0.74], position: [0, 0.58, -0.95], material: bronzeTable())
        addBox(to: root, name: "meeting-table-base", size: [0.42, 0.48, 0.42], position: [0, 0.34, -0.95], material: bronzeTable())
    }

    private static func addLoungeFurniture(to root: Entity) {
        addSofa(to: root, name: "left-sofa", position: [-1.8, 0.42, -0.95], width: 1.15, depth: 0.72)
        addSofa(to: root, name: "right-sofa", position: [1.8, 0.42, -0.95], width: 1.15, depth: 0.72)
        addSofa(to: root, name: "back-sofa", position: [0, 0.42, -2.2], width: 2.6, depth: 0.68)
        addBox(to: root, name: "side-chair", size: [0.72, 0.42, 0.72], position: [2.75, 0.43, 0.55], material: darkLeather())
    }

    private static func addSofa(to root: Entity, name: String, position: SIMD3<Float>, width: Float, depth: Float) {
        addBox(to: root, name: "\(name)-seat", size: [width, 0.26, depth], position: position, material: darkLeather())
        addBox(to: root, name: "\(name)-back", size: [width, 0.58, 0.16], position: [position.x, position.y + 0.25, position.z - depth / 2], material: darkLeather())
        addBox(to: root, name: "\(name)-left-arm", size: [0.16, 0.42, depth], position: [position.x - width / 2, position.y + 0.1, position.z], material: darkLeather())
        addBox(to: root, name: "\(name)-right-arm", size: [0.16, 0.42, depth], position: [position.x + width / 2, position.y + 0.1, position.z], material: darkLeather())
    }

    private static func addCeilingLightWells(to root: Entity) {
        addBox(to: root, name: "ceiling-light-left", size: [3.4, 0.035, 0.42], position: [-2.7, 4.48, -2.95], material: warmLight())
        addBox(to: root, name: "ceiling-light-right", size: [3.4, 0.035, 0.42], position: [2.7, 4.48, -2.95], material: warmLight())
        addBox(to: root, name: "back-wall-light-slot", size: [3.2, 0.5, 0.035], position: [0, 3.2, -4.22], material: warmLight())
    }

    private static func addWaterCaustics(to root: Entity) {
        for index in 0..<34 {
            let x = Float(index % 9) * 1.18 - 4.7
            let y = Float(index / 9) * 0.54 + 1.05
            let width = Float(0.68 + Double(index % 4) * 0.16)
            addBox(
                to: root,
                name: "caustic-back-\(index)",
                size: [width, 0.025, 0.012],
                position: [x, y, -4.235],
                material: caustic()
            )
        }

        for index in 0..<20 {
            let z = Float(index % 7) * 0.78 - 3.1
            let y = Float(index / 7) * 0.7 + 1.25
            addBox(to: root, name: "caustic-side-left-\(index)", size: [0.012, 0.024, 0.62], position: [-5.735, y, z], material: caustic())
            addBox(to: root, name: "caustic-side-right-\(index)", size: [0.012, 0.024, 0.62], position: [5.735, y, z], material: caustic())
        }

        for index in 0..<18 {
            let x = Float(index % 6) * 1.2 - 3.0
            let z = Float(index / 6) * 0.7 - 1.6
            addBox(to: root, name: "caustic-floor-\(index)", size: [0.75, 0.018, 0.028], position: [x, 0.285, z], material: caustic())
        }
    }

    @discardableResult
    private static func addBox(
        to root: Entity,
        name: String,
        size: SIMD3<Float>,
        position: SIMD3<Float>,
        material: any Material
    ) -> ModelEntity {
        let mesh = MeshResource.generateBox(width: size.x, height: size.y, depth: size.z)
        let entity = ModelEntity(mesh: mesh, materials: [material])
        entity.name = name
        entity.position = position
        root.addChild(entity)
        return entity
    }

    private static func simple(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat = 1.0, roughness: Float = 0.4, metallic: Bool = false) -> SimpleMaterial {
        SimpleMaterial(color: UIColor(red: red, green: green, blue: blue, alpha: alpha), roughness: roughness, isMetallic: metallic)
    }

    private static func unlit(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat = 1.0) -> UnlitMaterial {
        UnlitMaterial(color: UIColor(red: red, green: green, blue: blue, alpha: alpha))
    }

    private static func glossyDarkFloor() -> SimpleMaterial { simple(0.025, 0.029, 0.032, roughness: 0.18) }
    private static func darkWall() -> SimpleMaterial { simple(0.012, 0.018, 0.018, roughness: 0.62) }
    private static func blackGloss() -> SimpleMaterial { simple(0.02, 0.022, 0.024, roughness: 0.16) }
    private static func blackDeskBase() -> SimpleMaterial { simple(0.015, 0.015, 0.016, roughness: 0.38) }
    private static func concrete() -> SimpleMaterial { simple(0.45, 0.43, 0.39, roughness: 0.82) }
    private static func chrome() -> SimpleMaterial { simple(0.78, 0.78, 0.74, roughness: 0.18, metallic: true) }
    private static func coolLight() -> UnlitMaterial { unlit(0.76, 0.9, 1.0, 0.92) }
    private static func grayMachine() -> SimpleMaterial { simple(0.48, 0.5, 0.48, roughness: 0.5) }
    private static func paper() -> SimpleMaterial { simple(0.88, 0.88, 0.84, roughness: 0.55) }
    private static func leather() -> SimpleMaterial { simple(0.23, 0.22, 0.2, roughness: 0.48) }
    private static func redAccent() -> UnlitMaterial { unlit(0.68, 0.02, 0.02, 0.96) }
    private static func warmStone() -> SimpleMaterial { simple(0.74, 0.58, 0.32, roughness: 0.28) }
    private static func goldStone() -> SimpleMaterial { simple(0.6, 0.38, 0.13, roughness: 0.33) }
    private static func bronzeCeiling() -> SimpleMaterial { simple(0.26, 0.16, 0.08, roughness: 0.24, metallic: true) }
    private static func water() -> SimpleMaterial { simple(0.03, 0.13, 0.15, 0.62, roughness: 0.04) }
    private static func bronzeTable() -> SimpleMaterial { simple(0.31, 0.2, 0.09, roughness: 0.2, metallic: true) }
    private static func darkLeather() -> SimpleMaterial { simple(0.055, 0.043, 0.035, roughness: 0.36) }
    private static func warmLight() -> UnlitMaterial { unlit(1.0, 0.72, 0.24, 0.88) }
    private static func caustic() -> UnlitMaterial { unlit(1.0, 0.76, 0.24, 0.34) }
}
