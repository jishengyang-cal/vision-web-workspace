import RealityKit
import UIKit

enum ImmersiveEnvironmentSceneFactory {
    private static let animatedOfficeLightPrefix = "office-light-animated-"
    private static let animatedOfficeRunwayPrefix = "office-runway-animated-"
    private static let animatedCausticPrefix = "lounge-caustic-animated-"
    private static let animatedWaterPrefix = "lounge-water-animated-"

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

    static func update(_ root: Entity, time: Float, baselines: inout [String: SIMD3<Float>]) {
        animateOfficeEntities(root, time: time, baselines: &baselines)
        animateLoungeEntities(root, time: time, baselines: &baselines)
    }

    private static func buildOffice(in root: Entity) {
        let spec = OfficeSceneSpec.load()
        root.name = "ImmersiveEnvironmentRoot-office-reference-rebuild"

        addReferenceOfficeShell(to: root, spec: spec)
        addReferenceOfficeRunway(to: root, spec: spec)
        addReferenceOfficeColumns(to: root, spec: spec)
        addReferenceOfficeDeskGrid(to: root, spec: spec)
        addReferenceOfficeCoatRacks(to: root, spec: spec)
        addReferenceOfficeAtmosphere(to: root, spec: spec)
    }

    private static func buildLounge(in root: Entity) {
        let spec = WaterLoungeSceneSpec.load()
        root.name = "ImmersiveEnvironmentRoot-lounge-reference-rebuild"

        addWaterLoungeShell(to: root, spec: spec)
        addWaterLoungePool(to: root, spec: spec)
        addWaterLoungePlatform(to: root, spec: spec)
        addWaterLoungeBridge(to: root, spec: spec)
        addWaterLoungeFurniture(to: root, spec: spec)
        addWaterLoungeLighting(to: root, spec: spec)
        addWaterLoungeCaustics(to: root, spec: spec)
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

    private static func addReferenceOfficeShell(to root: Entity, spec: OfficeSceneSpec) {
        let room = spec.room
        addBox(to: root, name: "office-reference-floor", size: [room.width, 0.055, room.depth], position: [0, 0, 0], material: officeBlackFloor())
        addBox(to: root, name: "office-reference-ceiling", size: [room.width, 0.06, room.depth], position: [0, room.height, 0], material: officeBlackCeiling())
        addBox(to: root, name: "office-reference-back-wall", size: [room.width, room.height, 0.05], position: [0, room.height / 2, -room.depth / 2], material: officeDeepWall())
        addBox(to: root, name: "office-reference-front-threshold", size: [room.width, room.height, 0.05], position: [0, room.height / 2, room.depth / 2], material: officeDeepWall())
        addBox(to: root, name: "office-reference-left-wall", size: [0.05, room.height, room.depth], position: [-room.width / 2, room.height / 2, 0], material: officeDeepWall())
        addBox(to: root, name: "office-reference-right-wall", size: [0.05, room.height, room.depth], position: [room.width / 2, room.height / 2, 0], material: officeDeepWall())
        addOfficeFloorRibs(to: root, spec: spec)
    }

    private static func addOfficeFloorRibs(to root: Entity, spec: OfficeSceneSpec) {
        let room = spec.room
        for index in 0..<18 {
            let x = -room.width / 2 + Float(index) * room.width / 17
            addBox(
                to: root,
                name: "office-reference-floor-rib-\(index)",
                size: [0.012, 0.01, room.depth],
                position: [x, 0.035, 0],
                material: officeFloorRib()
            )
        }
    }

    private static func addReferenceOfficeRunway(to root: Entity, spec: OfficeSceneSpec) {
        let runway = spec.runway
        let room = spec.room
        addBox(
            to: root,
            name: "\(animatedOfficeRunwayPrefix)red-floor-axis",
            size: [runway.redWidth, 0.014, runway.length],
            position: [0, 0.045, -0.05],
            material: officeRunwayRed()
        )
        addBox(
            to: root,
            name: "office-reference-runway-white-left",
            size: [runway.whiteWidth, 0.016, runway.length],
            position: [-runway.whiteOffset, 0.049, -0.05],
            material: officeRunwayWhite()
        )
        addBox(
            to: root,
            name: "office-reference-runway-white-right",
            size: [runway.whiteWidth, 0.016, runway.length],
            position: [runway.whiteOffset, 0.049, -0.05],
            material: officeRunwayWhite()
        )
        addBox(
            to: root,
            name: "\(animatedOfficeRunwayPrefix)back-wall-red-axis",
            size: [runway.redWidth * 0.9, room.height - 0.25, 0.018],
            position: [0, room.height / 2, -room.depth / 2 + 0.055],
            material: officeRunwayRed()
        )
        addBox(
            to: root,
            name: "office-reference-back-wall-white-axis-left",
            size: [runway.whiteWidth, room.height - 0.25, 0.02],
            position: [-runway.whiteOffset, room.height / 2, -room.depth / 2 + 0.058],
            material: officeRunwayWhite()
        )
        addBox(
            to: root,
            name: "office-reference-back-wall-white-axis-right",
            size: [runway.whiteWidth, room.height - 0.25, 0.02],
            position: [runway.whiteOffset, room.height / 2, -room.depth / 2 + 0.058],
            material: officeRunwayWhite()
        )
    }

    private static func addReferenceOfficeColumns(to root: Entity, spec: OfficeSceneSpec) {
        var index = 0
        for x in spec.column.xPositions {
            for z in spec.column.zPositions {
                addBox(
                    to: root,
                    name: "office-reference-concrete-column-\(index)",
                    size: [spec.column.width, spec.room.height - 0.12, spec.column.depth],
                    position: [x, spec.room.height / 2, z],
                    material: officeRoughConcrete()
                )
                addBox(
                    to: root,
                    name: "office-reference-concrete-column-band-\(index)-lower",
                    size: [spec.column.width + 0.03, 0.014, spec.column.depth + 0.03],
                    position: [x, 1.72, z],
                    material: officeConcreteSeam()
                )
                addBox(
                    to: root,
                    name: "office-reference-concrete-column-band-\(index)-upper",
                    size: [spec.column.width + 0.03, 0.014, spec.column.depth + 0.03],
                    position: [x, 3.22, z],
                    material: officeConcreteSeam()
                )
                addBox(
                    to: root,
                    name: "\(animatedOfficeLightPrefix)column-uplight-\(index)",
                    size: [spec.lighting.columnGlowWidth, 0.012, spec.lighting.columnGlowWidth],
                    position: [x, 0.05, z],
                    material: officeCoolFloorGlow()
                )
                index += 1
            }
        }
    }

    private static func addReferenceOfficeDeskGrid(to root: Entity, spec: OfficeSceneSpec) {
        var index = 0
        for z in spec.deskGrid.zPositions {
            for x in spec.deskGrid.xPositions {
                addReferenceOfficeDesk(to: root, spec: spec, position: [x, spec.desk.topHeight, z], index: index)
                index += 1
            }
        }
    }

    private static func addReferenceOfficeDesk(to root: Entity, spec: OfficeSceneSpec, position: SIMD3<Float>, index: Int) {
        let desk = spec.desk
        addBox(to: root, name: "office-reference-desk-top-\(index)", size: [desk.width, desk.topThickness, desk.depth], position: position, material: officeDeskSurface())
        addBox(to: root, name: "office-reference-desk-base-\(index)", size: [desk.baseWidth, desk.baseHeight, desk.baseDepth], position: [position.x, desk.baseHeight / 2, position.z], material: officeDeskCase())
        addBox(to: root, name: "office-reference-desk-front-panel-\(index)", size: [desk.width * 0.82, 0.48, 0.04], position: [position.x, 0.39, position.z + desk.depth / 2 - 0.03], material: officeDeskCase())
        addBox(to: root, name: "office-reference-desk-left-leg-\(index)", size: [0.04, 0.62, 0.04], position: [position.x - desk.width * 0.42, 0.31, position.z + desk.depth * 0.36], material: chrome())
        addBox(to: root, name: "office-reference-desk-right-leg-\(index)", size: [0.04, 0.62, 0.04], position: [position.x + desk.width * 0.42, 0.31, position.z + desk.depth * 0.36], material: chrome())
        addBox(
            to: root,
            name: "\(animatedOfficeLightPrefix)desk-under-glow-\(index)",
            size: [spec.lighting.underDeskGlowWidth, 0.012, spec.lighting.underDeskGlowDepth],
            position: [position.x, 0.048, position.z + 0.08],
            material: officeCoolFloorGlow()
        )

        let lampX = position.x + desk.width * 0.3
        let lampZ = position.z - desk.depth * 0.18
        addBox(to: root, name: "office-reference-lamp-stem-\(index)", size: [0.035, 0.58, 0.035], position: [lampX, spec.lighting.lampHeight - 0.3, lampZ], material: chrome())
        addBox(to: root, name: "office-reference-lamp-shade-\(index)", size: [spec.lighting.shadeWidth, 0.085, spec.lighting.shadeDepth], position: [lampX, spec.lighting.lampHeight, lampZ], material: officeLampShade())
        addBox(
            to: root,
            name: "\(animatedOfficeLightPrefix)lamp-pool-\(index)",
            size: [spec.lighting.shadeWidth * 0.9, 0.012, spec.lighting.shadeDepth * 0.9],
            position: [lampX, position.y + desk.topThickness / 2 + 0.018, lampZ],
            material: officeCoolLampGlow()
        )

        let typewriterX = position.x - desk.width * 0.22
        addBox(to: root, name: "office-reference-typewriter-base-\(index)", size: [spec.props.typewriterWidth, 0.12, 0.27], position: [typewriterX, position.y + 0.1, position.z - 0.03], material: officeTypewriter())
        addBox(to: root, name: "office-reference-typewriter-roller-\(index)", size: [spec.props.typewriterWidth * 0.78, 0.045, 0.055], position: [typewriterX, position.y + 0.18, position.z - 0.17], material: blackDeskBase())
        addBox(to: root, name: "office-reference-paper-stack-\(index)", size: [spec.props.paperWidth, 0.024, 0.24], position: [position.x + 0.08, position.y + 0.055, position.z + 0.17], material: paper())
        addBox(to: root, name: "office-reference-lamp-cord-\(index)", size: [0.46, 0.012, 0.018], position: [lampX - 0.27, position.y + 0.055, lampZ + 0.24], material: officeCord())
        addBox(to: root, name: "office-reference-chair-\(index)", size: [0.5, 0.44, 0.46], position: [position.x, 0.32, position.z + desk.depth * 0.86], material: officeChair())

        if spec.props.includeOperators {
            addReferenceOfficeOperator(to: root, position: [position.x, 0.74, position.z + desk.depth * 0.92], index: index)
        }
    }

    private static func addReferenceOfficeOperator(to root: Entity, position: SIMD3<Float>, index: Int) {
        addBox(to: root, name: "office-reference-operator-torso-\(index)", size: [0.32, 0.5, 0.18], position: [position.x, position.y + 0.17, position.z], material: officeSuitGray())
        addBox(to: root, name: "office-reference-operator-shirt-\(index)", size: [0.11, 0.32, 0.02], position: [position.x, position.y + 0.18, position.z - 0.096], material: paper())
        addBox(to: root, name: "office-reference-operator-tie-\(index)", size: [0.035, 0.32, 0.022], position: [position.x, position.y + 0.11, position.z - 0.11], material: officeRunwayRed())
        addBox(to: root, name: "office-reference-operator-head-\(index)", size: [0.18, 0.2, 0.16], position: [position.x, position.y + 0.54, position.z - 0.01], material: officeSkin())
        addBox(to: root, name: "office-reference-operator-hair-\(index)", size: [0.18, 0.04, 0.16], position: [position.x, position.y + 0.66, position.z - 0.01], material: blackDeskBase())
        addBox(to: root, name: "office-reference-operator-glasses-\(index)", size: [0.17, 0.012, 0.018], position: [position.x, position.y + 0.56, position.z - 0.1], material: blackGloss())
    }

    private static func addReferenceOfficeCoatRacks(to root: Entity, spec: OfficeSceneSpec) {
        guard spec.props.includeCoatRacks else { return }

        for side in 0..<2 {
            let x = side == 0 ? -spec.room.width / 2 + 0.62 : spec.room.width / 2 - 0.62
            let sideName = side == 0 ? "left" : "right"
            for index in 0..<spec.deskGrid.zPositions.count {
                let z = spec.deskGrid.zPositions[index]
                addBox(to: root, name: "office-reference-\(sideName)-coat-rack-pole-\(index)", size: [0.035, 1.25, 0.035], position: [x, 0.72, z + 0.36], material: chrome())
                addBox(to: root, name: "office-reference-\(sideName)-coat-rack-arm-\(index)", size: [0.5, 0.03, 0.035], position: [x, 1.32, z + 0.36], material: chrome())
                addBox(to: root, name: "office-reference-\(sideName)-coat-\(index)", size: [0.34, 0.54, 0.08], position: [x, 1.02, z + 0.48], material: officeCoatTan())
            }
        }
    }

    private static func addReferenceOfficeAtmosphere(to root: Entity, spec: OfficeSceneSpec) {
        addBox(
            to: root,
            name: "office-reference-red-exit-sign",
            size: [0.48, 0.18, 0.018],
            position: [0, spec.room.height - 1.18, -spec.room.depth / 2 + 0.06],
            material: officeExitRed()
        )
        addBox(
            to: root,
            name: "\(animatedOfficeLightPrefix)back-wall-low-wash-left",
            size: [2.7, 0.018, 0.018],
            position: [-3.6, 0.55, -spec.room.depth / 2 + 0.065],
            material: officeCoolFloorGlow()
        )
        addBox(
            to: root,
            name: "\(animatedOfficeLightPrefix)back-wall-low-wash-right",
            size: [2.7, 0.018, 0.018],
            position: [3.6, 0.55, -spec.room.depth / 2 + 0.065],
            material: officeCoolFloorGlow()
        )
    }

    private static func addWaterLoungeShell(to root: Entity, spec: WaterLoungeSceneSpec) {
        let room = spec.room
        let floorY = spec.water.surfaceY - 0.09
        addBox(to: root, name: "lounge-water-basin-floor", size: [room.width, 0.08, room.depth], position: [0, floorY, 0], material: blackWaterBasin())
        addWallPanelGrid(to: root, name: "lounge-back-wall", wall: .back, room: room)
        addWallPanelGrid(to: root, name: "lounge-left-wall", wall: .left, room: room)
        addWallPanelGrid(to: root, name: "lounge-right-wall", wall: .right, room: room)

        addBox(
            to: root,
            name: "lounge-ceiling-soffit-dark-center",
            size: [room.width * 0.52, 0.08, room.depth],
            position: [0, room.height, 0],
            material: bronzeCeiling()
        )
        addBox(
            to: root,
            name: "lounge-ceiling-left-stone-return",
            size: [room.width * 0.24, 0.08, room.depth],
            position: [-room.width * 0.38, room.height, 0],
            material: amberStone()
        )
        addBox(
            to: root,
            name: "lounge-ceiling-right-stone-return",
            size: [room.width * 0.24, 0.08, room.depth],
            position: [room.width * 0.38, room.height, 0],
            material: amberStone()
        )
    }

    private static func addWaterLoungePool(to root: Entity, spec: WaterLoungeSceneSpec) {
        let room = spec.room
        let water = spec.water
        addBox(
            to: root,
            name: "\(animatedWaterPrefix)main-pool",
            size: [room.width - 0.18, water.height, room.depth - 0.18],
            position: [0, water.surfaceY, 0],
            material: blackGoldWater()
        )

        for index in 0..<18 {
            let x = Float(index % 6) * 1.92 - 4.8
            let z = Float(index / 6) * 1.55 + 1.65
            addBox(
                to: root,
                name: "\(animatedWaterPrefix)gold-ripple-\(index)",
                size: [0.95 + Float(index % 3) * 0.24, 0.01, 0.035],
                position: [x, water.surfaceY + 0.035, z],
                material: waterHighlight()
            )
        }
    }

    private static func addWaterLoungePlatform(to root: Entity, spec: WaterLoungeSceneSpec) {
        let platform = spec.platform
        addBox(
            to: root,
            name: "lounge-square-meeting-platform",
            size: [platform.width, platform.height, platform.depth],
            position: [0, spec.water.surfaceY + platform.height / 2, platform.centerZ],
            material: platformStone()
        )
        addBox(
            to: root,
            name: "lounge-platform-front-shadow-lip",
            size: [platform.width, 0.035, 0.08],
            position: [0, spec.water.surfaceY + 0.02, platform.centerZ + platform.depth / 2 + 0.02],
            material: blackWaterBasin()
        )
        addPlatformPanelSeams(to: root, spec: spec)
    }

    private static func addWaterLoungeBridge(to root: Entity, spec: WaterLoungeSceneSpec) {
        let bridge = spec.bridge
        let y = spec.water.surfaceY + bridge.slabHeight / 2 + 0.03
        for index in 0..<bridge.count {
            let z = bridge.startZ - Float(index) * (bridge.slabDepth + bridge.gap)
            addBox(
                to: root,
                name: "lounge-separated-bridge-slab-\(index + 1)",
                size: [bridge.slabWidth, bridge.slabHeight, bridge.slabDepth],
                position: [0, y, z],
                material: bridgeStone()
            )
            addBox(
                to: root,
                name: "\(animatedCausticPrefix)bridge-\(index)",
                size: [bridge.slabWidth * 0.72, 0.012, 0.018],
                position: [0.08 * sin(Float(index)), y + bridge.slabHeight / 2 + 0.01, z],
                material: caustic(alpha: 0.18 * spec.caustics.bridgeIntensity)
            )
        }
    }

    private static func addWaterLoungeFurniture(to root: Entity, spec: WaterLoungeSceneSpec) {
        let furniture = spec.furniture
        let platformY = spec.water.surfaceY + spec.platform.height
        addReferenceSofa(
            to: root,
            name: "lounge-left-leather-sofa",
            position: [-1.55, platformY + 0.26, spec.platform.centerZ - 0.35],
            width: furniture.sofaWidth,
            depth: furniture.sofaDepth,
            height: furniture.sofaHeight,
            facing: .right
        )
        addReferenceSofa(
            to: root,
            name: "lounge-right-leather-sofa",
            position: [1.55, platformY + 0.26, spec.platform.centerZ - 0.35],
            width: furniture.sofaWidth,
            depth: furniture.sofaDepth,
            height: furniture.sofaHeight,
            facing: .left
        )
        addReferenceSofa(
            to: root,
            name: "lounge-back-leather-sofa",
            position: [0, platformY + 0.26, spec.platform.centerZ - 1.95],
            width: furniture.sofaWidth * 1.55,
            depth: furniture.sofaDepth,
            height: furniture.sofaHeight,
            facing: .front
        )
        addConcreteTeaTable(to: root, spec: spec)
    }

    private static func addWaterLoungeLighting(to root: Entity, spec: WaterLoungeSceneSpec) {
        let room = spec.room
        let lighting = spec.lighting
        addBox(
            to: root,
            name: "lounge-ceiling-left-gold-light-well",
            size: [lighting.sideLightWidth, 0.035, lighting.sideLightDepth],
            position: [-room.width * 0.28, lighting.ceilingHeight + 0.035, -room.depth * 0.36],
            material: warmLight()
        )
        addBox(
            to: root,
            name: "lounge-ceiling-right-gold-light-well",
            size: [lighting.sideLightWidth, 0.035, lighting.sideLightDepth],
            position: [room.width * 0.28, lighting.ceilingHeight + 0.035, -room.depth * 0.36],
            material: warmLight()
        )
        addBox(
            to: root,
            name: "lounge-back-wall-upper-glow-slot",
            size: [lighting.backWallLightWidth, lighting.backWallLightHeight, 0.02],
            position: [0, room.height - 0.82, -room.depth / 2 + 0.04],
            material: warmLight()
        )
        addBox(
            to: root,
            name: "lounge-waterline-gold-glow",
            size: [room.width - 1.1, 0.035, 0.018],
            position: [0, spec.water.surfaceY + 0.12, -room.depth / 2 + 0.05],
            material: waterHighlight()
        )
    }

    private static func addWaterLoungeCaustics(to root: Entity, spec: WaterLoungeSceneSpec) {
        addBackWallCaustics(to: root, spec: spec)
        addSideWallCaustics(to: root, spec: spec)
        addPlatformCaustics(to: root, spec: spec)
        addFurnitureCaustics(to: root, spec: spec)
    }

    private enum WallOrientation {
        case back
        case left
        case right
    }

    private enum SofaFacing {
        case left
        case right
        case front
    }

    private static func addWallPanelGrid(to root: Entity, name: String, wall: WallOrientation, room: WaterLoungeSceneSpec.Room) {
        switch wall {
        case .back:
            addBox(to: root, name: name, size: [room.width, room.height, 0.05], position: [0, room.height / 2, -room.depth / 2], material: amberStone())
            for column in 1..<6 {
                let x = -room.width / 2 + Float(column) * room.width / 6
                addBox(to: root, name: "\(name)-vertical-seam-\(column)", size: [0.015, room.height, 0.018], position: [x, room.height / 2, -room.depth / 2 + 0.031], material: panelSeam())
            }
            for row in 1..<5 {
                let y = Float(row) * room.height / 5
                addBox(to: root, name: "\(name)-horizontal-seam-\(row)", size: [room.width, 0.012, 0.018], position: [0, y, -room.depth / 2 + 0.032], material: panelSeam())
            }
        case .left:
            addBox(to: root, name: name, size: [0.05, room.height, room.depth], position: [-room.width / 2, room.height / 2, 0], material: amberStone())
            for column in 1..<5 {
                let z = -room.depth / 2 + Float(column) * room.depth / 5
                addBox(to: root, name: "\(name)-vertical-seam-\(column)", size: [0.018, room.height, 0.015], position: [-room.width / 2 + 0.032, room.height / 2, z], material: panelSeam())
            }
            for row in 1..<5 {
                let y = Float(row) * room.height / 5
                addBox(to: root, name: "\(name)-horizontal-seam-\(row)", size: [0.018, 0.012, room.depth], position: [-room.width / 2 + 0.033, y, 0], material: panelSeam())
            }
        case .right:
            addBox(to: root, name: name, size: [0.05, room.height, room.depth], position: [room.width / 2, room.height / 2, 0], material: amberStone())
            for column in 1..<5 {
                let z = -room.depth / 2 + Float(column) * room.depth / 5
                addBox(to: root, name: "\(name)-vertical-seam-\(column)", size: [0.018, room.height, 0.015], position: [room.width / 2 - 0.032, room.height / 2, z], material: panelSeam())
            }
            for row in 1..<5 {
                let y = Float(row) * room.height / 5
                addBox(to: root, name: "\(name)-horizontal-seam-\(row)", size: [0.018, 0.012, room.depth], position: [room.width / 2 - 0.033, y, 0], material: panelSeam())
            }
        }
    }

    private static func addPlatformPanelSeams(to root: Entity, spec: WaterLoungeSceneSpec) {
        let platform = spec.platform
        let topY = spec.water.surfaceY + platform.height + 0.012
        for index in 1..<4 {
            let x = -platform.width / 2 + Float(index) * platform.width / 4
            addBox(to: root, name: "lounge-platform-x-seam-\(index)", size: [0.018, 0.012, platform.depth], position: [x, topY, platform.centerZ], material: platformSeam())
        }
        for index in 1..<4 {
            let z = platform.centerZ - platform.depth / 2 + Float(index) * platform.depth / 4
            addBox(to: root, name: "lounge-platform-z-seam-\(index)", size: [platform.width, 0.012, 0.018], position: [0, topY, z], material: platformSeam())
        }
    }

    private static func addReferenceSofa(
        to root: Entity,
        name: String,
        position: SIMD3<Float>,
        width: Float,
        depth: Float,
        height: Float,
        facing: SofaFacing
    ) {
        let seat = addBox(to: root, name: "\(name)-seat", size: [width, 0.22, depth], position: position, material: darkLeather())
        let backOffset: SIMD3<Float>
        let leftArmPosition: SIMD3<Float>
        let rightArmPosition: SIMD3<Float>
        let backSize: SIMD3<Float>
        let armSize: SIMD3<Float>

        switch facing {
        case .left:
            backOffset = [width / 2 - 0.08, 0.22, 0]
            backSize = [0.16, height, depth]
            armSize = [width, 0.36, 0.15]
            leftArmPosition = [0, 0.08, -depth / 2 + 0.07]
            rightArmPosition = [0, 0.08, depth / 2 - 0.07]
        case .right:
            backOffset = [-width / 2 + 0.08, 0.22, 0]
            backSize = [0.16, height, depth]
            armSize = [width, 0.36, 0.15]
            leftArmPosition = [0, 0.08, -depth / 2 + 0.07]
            rightArmPosition = [0, 0.08, depth / 2 - 0.07]
        case .front:
            backOffset = [0, 0.22, -depth / 2 + 0.08]
            backSize = [width, height, 0.16]
            armSize = [0.15, 0.36, depth]
            leftArmPosition = [-width / 2 + 0.07, 0.08, 0]
            rightArmPosition = [width / 2 - 0.07, 0.08, 0]
        }

        _ = seat
        addBox(to: root, name: "\(name)-back", size: backSize, position: position + backOffset, material: darkLeather())
        addBox(to: root, name: "\(name)-left-arm", size: armSize, position: position + leftArmPosition, material: darkLeather())
        addBox(to: root, name: "\(name)-right-arm", size: armSize, position: position + rightArmPosition, material: darkLeather())
        addBox(to: root, name: "\(name)-front-leg-left", size: [0.045, 0.22, 0.045], position: [position.x - width * 0.32, position.y - 0.22, position.z + depth * 0.32], material: chrome())
        addBox(to: root, name: "\(name)-front-leg-right", size: [0.045, 0.22, 0.045], position: [position.x + width * 0.32, position.y - 0.22, position.z + depth * 0.32], material: chrome())
        addBox(to: root, name: "\(animatedCausticPrefix)\(name)-seat-glint", size: [width * 0.55, 0.015, 0.024], position: [position.x, position.y + 0.125, position.z + depth * 0.08], material: caustic(alpha: 0.2))
    }

    private static func addConcreteTeaTable(to root: Entity, spec: WaterLoungeSceneSpec) {
        let platformY = spec.water.surfaceY + spec.platform.height
        let furniture = spec.furniture
        let center: SIMD3<Float> = [0, platformY + furniture.tableHeight / 2, spec.platform.centerZ - 0.32]
        addBox(to: root, name: "lounge-cement-tea-table-top", size: [furniture.tableWidth, 0.13, furniture.tableDepth], position: [center.x, center.y + 0.18, center.z], material: polishedConcrete())
        addBox(to: root, name: "lounge-cement-tea-table-base", size: [0.62, furniture.tableHeight, furniture.tableDepth * 0.55], position: center, material: polishedConcrete())
        addBox(to: root, name: "\(animatedCausticPrefix)table-top-glow", size: [furniture.tableWidth * 0.78, 0.014, 0.022], position: [center.x, center.y + 0.255, center.z - 0.06], material: caustic(alpha: 0.24))
        addBox(to: root, name: "lounge-table-object-tray", size: [0.42, 0.035, 0.22], position: [center.x - 0.42, center.y + 0.34, center.z], material: blackGloss())
        addBox(to: root, name: "lounge-table-object-box", size: [0.22, 0.14, 0.22], position: [center.x + 0.42, center.y + 0.39, center.z - 0.04], material: blackDeskBase())
    }

    private static func addBackWallCaustics(to root: Entity, spec: WaterLoungeSceneSpec) {
        let room = spec.room
        for row in 0..<spec.caustics.wallRows {
            for column in 0..<spec.caustics.wallColumns {
                let index = row * spec.caustics.wallColumns + column
                let x = -room.width * 0.42 + Float(column) * room.width * 0.84 / Float(max(1, spec.caustics.wallColumns - 1))
                let y = 1.05 + Float(row) * 0.58
                let width = 0.48 + Float((index * 7) % 5) * 0.11
                addBox(
                    to: root,
                    name: "\(animatedCausticPrefix)back-wall-\(index)",
                    size: [width, 0.018, 0.012],
                    position: [x, y, -room.depth / 2 + 0.058],
                    material: caustic(alpha: 0.26)
                )
            }
        }
    }

    private static func addSideWallCaustics(to root: Entity, spec: WaterLoungeSceneSpec) {
        let room = spec.room
        for side in 0..<2 {
            let x = side == 0 ? -room.width / 2 + 0.058 : room.width / 2 - 0.058
            let sideName = side == 0 ? "left" : "right"
            for row in 0..<spec.caustics.sideRows {
                for column in 0..<spec.caustics.sideColumns {
                    let index = row * spec.caustics.sideColumns + column
                    let z = -room.depth * 0.36 + Float(column) * room.depth * 0.72 / Float(max(1, spec.caustics.sideColumns - 1))
                    let y = 1.15 + Float(row) * 0.56
                    addBox(
                        to: root,
                        name: "\(animatedCausticPrefix)\(sideName)-wall-\(index)",
                        size: [0.012, 0.018, 0.52 + Float(index % 3) * 0.16],
                        position: [x, y, z],
                        material: caustic(alpha: 0.22)
                    )
                }
            }
        }
    }

    private static func addPlatformCaustics(to root: Entity, spec: WaterLoungeSceneSpec) {
        let platform = spec.platform
        let topY = spec.water.surfaceY + platform.height + 0.026
        for index in 0..<spec.caustics.platformCount {
            let x = -platform.width * 0.42 + Float(index % 7) * platform.width * 0.84 / 6
            let z = platform.centerZ - platform.depth * 0.38 + Float(index / 7) * 0.82
            addBox(
                to: root,
                name: "\(animatedCausticPrefix)platform-\(index)",
                size: [0.5 + Float(index % 4) * 0.12, 0.012, 0.018],
                position: [x, topY, z],
                material: caustic(alpha: 0.16)
            )
        }
    }

    private static func addFurnitureCaustics(to root: Entity, spec: WaterLoungeSceneSpec) {
        let y = spec.water.surfaceY + spec.platform.height + 0.55
        for index in 0..<10 {
            let x = Float(index % 5) * 0.55 - 1.1
            let z = spec.platform.centerZ - 2.35 + Float(index / 5) * 0.38
            addBox(
                to: root,
                name: "\(animatedCausticPrefix)back-sofa-\(index)",
                size: [0.34 + Float(index % 2) * 0.16, 0.014, 0.018],
                position: [x, y, z],
                material: caustic(alpha: 0.18)
            )
        }
    }

    private static func animateOfficeEntities(_ entity: Entity, time: Float, baselines: inout [String: SIMD3<Float>]) {
        if entity.name.hasPrefix(animatedOfficeLightPrefix) {
            let baseline = baselinePosition(for: entity, in: &baselines)
            let phase = animationPhase(for: entity.name)
            entity.position = baseline + [
                0,
                sin(time * 0.8 + phase) * 0.004,
                0
            ]
            entity.scale = [
                1.0 + sin(time * 0.78 + phase) * 0.08,
                1.0,
                1.0 + cos(time * 0.66 + phase) * 0.08
            ]
        } else if entity.name.hasPrefix(animatedOfficeRunwayPrefix) {
            let baseline = baselinePosition(for: entity, in: &baselines)
            let phase = animationPhase(for: entity.name)
            entity.position = baseline + [
                0,
                sin(time * 0.42 + phase) * 0.003,
                0
            ]
            entity.scale = [
                1.0 + sin(time * 0.5 + phase) * 0.025,
                1.0,
                1.0
            ]
        }

        for child in entity.children {
            animateOfficeEntities(child, time: time, baselines: &baselines)
        }
    }

    private static func animateLoungeEntities(_ entity: Entity, time: Float, baselines: inout [String: SIMD3<Float>]) {
        if entity.name.hasPrefix(animatedCausticPrefix) {
            let baseline = baselinePosition(for: entity, in: &baselines)
            let phase = animationPhase(for: entity.name)
            let drift: SIMD3<Float> = [
                sin(time * 0.72 + phase) * 0.035,
                cos(time * 0.57 + phase * 0.7) * 0.012,
                sin(time * 0.49 + phase * 1.3) * 0.028
            ]
            entity.position = baseline + drift
            entity.scale = [
                1.0 + sin(time * 0.86 + phase) * 0.16,
                1.0 + cos(time * 1.08 + phase) * 0.06,
                1.0 + sin(time * 0.63 + phase * 0.4) * 0.12
            ]
        } else if entity.name.hasPrefix(animatedWaterPrefix) {
            let baseline = baselinePosition(for: entity, in: &baselines)
            let phase = animationPhase(for: entity.name)
            entity.position = baseline + [
                0,
                sin(time * 0.52 + phase) * 0.006,
                0
            ]
            entity.scale = [
                1.0 + sin(time * 0.34 + phase) * 0.012,
                1.0,
                1.0 + cos(time * 0.39 + phase) * 0.018
            ]
        }

        for child in entity.children {
            animateLoungeEntities(child, time: time, baselines: &baselines)
        }
    }

    private static func baselinePosition(for entity: Entity, in baselines: inout [String: SIMD3<Float>]) -> SIMD3<Float> {
        if let baseline = baselines[entity.name] {
            return baseline
        }

        baselines[entity.name] = entity.position
        return entity.position
    }

    private static func animationPhase(for name: String) -> Float {
        let hash = name.utf8.reduce(UInt32(2_166_136_261)) { partial, byte in
            (partial ^ UInt32(byte)) &* 16_777_619
        }
        return Float(hash % 6_283) / 1_000.0
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
        SimpleMaterial(color: UIColor(red: red, green: green, blue: blue, alpha: alpha), roughness: .float(roughness), isMetallic: metallic)
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
    private static func officeBlackFloor() -> SimpleMaterial { simple(0.01, 0.012, 0.012, roughness: 0.2) }
    private static func officeBlackCeiling() -> SimpleMaterial { simple(0.006, 0.007, 0.007, roughness: 0.72) }
    private static func officeDeepWall() -> SimpleMaterial { simple(0.004, 0.007, 0.007, roughness: 0.8) }
    private static func officeFloorRib() -> SimpleMaterial { simple(0.08, 0.09, 0.09, 0.28, roughness: 0.58) }
    private static func officeRunwayRed() -> UnlitMaterial { unlit(0.86, 0.02, 0.02, 0.96) }
    private static func officeRunwayWhite() -> UnlitMaterial { unlit(0.92, 0.9, 0.84, 0.94) }
    private static func officeDeskSurface() -> SimpleMaterial { simple(0.018, 0.02, 0.02, roughness: 0.13) }
    private static func officeDeskCase() -> SimpleMaterial { simple(0.012, 0.012, 0.012, roughness: 0.36) }
    private static func officeRoughConcrete() -> SimpleMaterial { simple(0.42, 0.4, 0.35, roughness: 0.9) }
    private static func officeConcreteSeam() -> SimpleMaterial { simple(0.22, 0.21, 0.19, roughness: 0.86) }
    private static func officeCoolFloorGlow() -> UnlitMaterial { unlit(0.62, 0.82, 1.0, 0.42) }
    private static func officeCoolLampGlow() -> UnlitMaterial { unlit(0.78, 0.92, 1.0, 0.58) }
    private static func officeLampShade() -> SimpleMaterial { simple(0.72, 0.72, 0.68, roughness: 0.16, metallic: true) }
    private static func officeTypewriter() -> SimpleMaterial { simple(0.18, 0.2, 0.19, roughness: 0.48) }
    private static func officeCord() -> SimpleMaterial { simple(0.74, 0.76, 0.72, roughness: 0.6) }
    private static func officeChair() -> SimpleMaterial { simple(0.48, 0.43, 0.36, roughness: 0.44) }
    private static func officeSuitGray() -> SimpleMaterial { simple(0.26, 0.27, 0.27, roughness: 0.48) }
    private static func officeSkin() -> SimpleMaterial { simple(0.64, 0.51, 0.42, roughness: 0.55) }
    private static func officeCoatTan() -> SimpleMaterial { simple(0.68, 0.58, 0.47, roughness: 0.64) }
    private static func officeExitRed() -> UnlitMaterial { unlit(0.88, 0.02, 0.02, 0.86) }
    private static func blackWaterBasin() -> SimpleMaterial { simple(0.008, 0.006, 0.004, roughness: 0.28) }
    private static func amberStone() -> SimpleMaterial { simple(0.72, 0.45, 0.16, roughness: 0.5) }
    private static func blackGoldWater() -> SimpleMaterial { simple(0.025, 0.015, 0.006, 0.78, roughness: 0.03) }
    private static func waterHighlight() -> UnlitMaterial { unlit(1.0, 0.68, 0.16, 0.45) }
    private static func platformStone() -> SimpleMaterial { simple(0.78, 0.56, 0.22, roughness: 0.36) }
    private static func bridgeStone() -> SimpleMaterial { simple(0.64, 0.45, 0.19, roughness: 0.5) }
    private static func panelSeam() -> SimpleMaterial { simple(0.18, 0.12, 0.07, roughness: 0.7) }
    private static func platformSeam() -> SimpleMaterial { simple(0.34, 0.23, 0.11, roughness: 0.65) }
    private static func polishedConcrete() -> SimpleMaterial { simple(0.46, 0.38, 0.27, roughness: 0.42) }
    private static func caustic(alpha: Float) -> UnlitMaterial { unlit(1.0, 0.72, 0.18, CGFloat(alpha)) }
}
