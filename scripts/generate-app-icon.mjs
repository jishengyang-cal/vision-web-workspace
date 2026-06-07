import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const size = 1024;
const assetRoot = "native/visionos/VisionWebWorkspace/Assets.xcassets";
const stackRoot = join(assetRoot, "AppIcon.solidimagestack");
const layers = [
  {
    id: "Front",
    filename: "vision-web-workspace-front.png",
    paint: paintFront
  },
  {
    id: "Middle",
    filename: "vision-web-workspace-middle.png",
    paint: paintMiddle
  },
  {
    id: "Back",
    filename: "vision-web-workspace-back.png",
    paint: paintBack
  }
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const mode = process.argv.includes("--check") ? "check" : "generate";

if (mode === "check") {
  checkIconStack();
} else {
  generateIconStack();
}

function generateIconStack() {
  ensureDir(assetRoot);
  writeJson(join(assetRoot, "Contents.json"), {
    info: {
      author: "xcode",
      version: 1
    }
  });

  ensureDir(stackRoot);
  writeJson(join(stackRoot, "Contents.json"), {
    info: {
      author: "xcode",
      version: 1
    },
    layers: layers.map((layer) => ({
      filename: `${layer.id}.solidimagestacklayer`
    }))
  });

  for (const layer of layers) {
    const layerRoot = join(stackRoot, `${layer.id}.solidimagestacklayer`);
    const imageRoot = join(layerRoot, "Content.imageset");
    ensureDir(imageRoot);

    writeJson(join(layerRoot, "Contents.json"), {
      info: {
        author: "xcode",
        version: 1
      }
    });

    writeJson(join(imageRoot, "Contents.json"), {
      images: [
        {
          filename: layer.filename,
          idiom: "vision",
          scale: "2x"
        }
      ],
      info: {
        author: "xcode",
        version: 1
      }
    });

    const pixels = new Uint8Array(size * size * 4);
    layer.paint(pixels);
    writeFileSync(join(imageRoot, layer.filename), encodePng(size, size, pixels));
  }

  checkIconStack();
  console.log(`Generated visionOS AppIcon image stack at ${stackRoot}`);
}

function checkIconStack() {
  const requiredFiles = [
    join(assetRoot, "Contents.json"),
    join(stackRoot, "Contents.json"),
    ...layers.flatMap((layer) => [
      join(stackRoot, `${layer.id}.solidimagestacklayer`, "Contents.json"),
      join(stackRoot, `${layer.id}.solidimagestacklayer`, "Content.imageset", "Contents.json"),
      join(stackRoot, `${layer.id}.solidimagestacklayer`, "Content.imageset", layer.filename)
    ])
  ];

  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      throw new Error(`Missing app icon asset: ${file}`);
    }
  }

  const stack = JSON.parse(readFileSync(join(stackRoot, "Contents.json"), "utf8"));
  const declaredLayers = stack.layers?.map((layer) => layer.filename) ?? [];
  for (const layer of layers) {
    const layerFolder = `${layer.id}.solidimagestacklayer`;
    if (!declaredLayers.includes(layerFolder)) {
      throw new Error(`AppIcon stack does not declare ${layerFolder}`);
    }

    const imagePath = join(stackRoot, layerFolder, "Content.imageset", layer.filename);
    const header = readPngHeader(imagePath);
    if (header.width !== size || header.height !== size) {
      throw new Error(`${imagePath} must be ${size}x${size}; got ${header.width}x${header.height}`);
    }
    if (header.colorType !== 6 || header.bitDepth !== 8) {
      throw new Error(`${imagePath} must be 8-bit RGBA PNG`);
    }
  }

  console.log("visionOS AppIcon image stack is present and valid.");
}

function paintBack(pixels) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const radius = Math.sqrt(nx * nx + ny * ny);
      const vertical = y / (size - 1);
      const glow = Math.max(0, 1 - radius);
      const horizon = Math.max(0, 1 - Math.abs(ny + 0.1) * 2.8);
      const red = 12 + 16 * (1 - vertical) + 10 * glow + 9 * horizon;
      const green = 22 + 36 * (1 - vertical) + 20 * glow + 20 * horizon;
      const blue = 28 + 50 * (1 - vertical) + 34 * glow + 28 * horizon;
      setPixel(pixels, x, y, [red, green, blue, 255]);
    }
  }

  for (let index = 0; index < 7; index += 1) {
    const inset = 96 + index * 48;
    const alpha = 20 - index * 2;
    strokeRoundedRect(pixels, inset, inset, size - inset * 2, size - inset * 2, 120, 2, [82, 185, 198, alpha]);
  }

  drawLine(pixels, 170, 720, 854, 720, 4, [85, 202, 218, 48]);
  drawLine(pixels, 238, 784, 786, 784, 3, [85, 202, 218, 30]);
}

function paintMiddle(pixels) {
  fillRoundedRect(pixels, 165, 342, 430, 300, 56, [55, 145, 165, 82]);
  strokeRoundedRect(pixels, 165, 342, 430, 300, 56, 5, [138, 232, 238, 108]);
  fillRoundedRect(pixels, 212, 388, 336, 42, 21, [210, 255, 255, 38]);
  drawLine(pixels, 238, 475, 510, 475, 8, [213, 255, 255, 50]);
  drawLine(pixels, 238, 532, 455, 532, 8, [213, 255, 255, 42]);

  fillRoundedRect(pixels, 420, 278, 436, 348, 58, [31, 95, 126, 118]);
  strokeRoundedRect(pixels, 420, 278, 436, 348, 58, 6, [186, 245, 255, 145]);
  fillRoundedRect(pixels, 470, 326, 302, 48, 24, [230, 255, 255, 48]);
  drawLine(pixels, 470, 434, 805, 434, 9, [230, 255, 255, 62]);
  drawLine(pixels, 470, 502, 746, 502, 9, [230, 255, 255, 52]);

  fillRoundedRect(pixels, 272, 662, 486, 96, 48, [15, 35, 42, 132]);
  strokeRoundedRect(pixels, 272, 662, 486, 96, 48, 5, [94, 213, 218, 110]);
  drawCircle(pixels, 340, 710, 14, [117, 255, 221, 134]);
  drawCircle(pixels, 392, 710, 14, [92, 199, 255, 128]);
  drawLine(pixels, 456, 710, 686, 710, 11, [230, 255, 255, 70]);
}

function paintFront(pixels) {
  fillRoundedRect(pixels, 250, 282, 524, 374, 68, [246, 255, 255, 34]);
  strokeRoundedRect(pixels, 250, 282, 524, 374, 68, 13, [244, 255, 255, 230]);
  drawLine(pixels, 276, 378, 748, 378, 8, [244, 255, 255, 182]);

  drawCircle(pixels, 324, 334, 15, [255, 115, 121, 236]);
  drawCircle(pixels, 374, 334, 15, [252, 198, 84, 236]);
  drawCircle(pixels, 424, 334, 15, [103, 236, 161, 236]);
  fillRoundedRect(pixels, 480, 315, 212, 38, 19, [245, 255, 255, 88]);

  drawLine(pixels, 420, 483, 502, 566, 24, [245, 255, 255, 224]);
  drawLine(pixels, 502, 566, 604, 438, 24, [245, 255, 255, 224]);
  drawLine(pixels, 604, 438, 604, 574, 24, [245, 255, 255, 224]);

  strokeRoundedRect(pixels, 338, 694, 348, 92, 46, 12, [245, 255, 255, 220]);
  drawLine(pixels, 386, 740, 638, 740, 10, [245, 255, 255, 160]);
}

function setPixel(pixels, x, y, rgba) {
  const index = (y * size + x) * 4;
  pixels[index] = clampByte(rgba[0]);
  pixels[index + 1] = clampByte(rgba[1]);
  pixels[index + 2] = clampByte(rgba[2]);
  pixels[index + 3] = clampByte(rgba[3]);
}

function blendPixel(pixels, x, y, rgba, coverage = 1) {
  if (x < 0 || y < 0 || x >= size || y >= size || coverage <= 0) {
    return;
  }

  const index = (Math.floor(y) * size + Math.floor(x)) * 4;
  const sourceAlpha = clamp01((rgba[3] / 255) * coverage);
  const targetAlpha = pixels[index + 3] / 255;
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) {
    return;
  }

  pixels[index] = clampByte((rgba[0] * sourceAlpha + pixels[index] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  pixels[index + 1] = clampByte((rgba[1] * sourceAlpha + pixels[index + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  pixels[index + 2] = clampByte((rgba[2] * sourceAlpha + pixels[index + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  pixels[index + 3] = clampByte(outAlpha * 255);
}

function fillRoundedRect(pixels, x, y, width, height, radius, rgba) {
  const minX = Math.max(0, Math.floor(x - 2));
  const maxX = Math.min(size - 1, Math.ceil(x + width + 2));
  const minY = Math.max(0, Math.floor(y - 2));
  const maxY = Math.min(size - 1, Math.ceil(y + height + 2));

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const distance = roundedRectDistance(px + 0.5, py + 0.5, x, y, width, height, radius);
      const coverage = smoothstep(1.2, -1.2, distance);
      blendPixel(pixels, px, py, rgba, coverage);
    }
  }
}

function strokeRoundedRect(pixels, x, y, width, height, radius, strokeWidth, rgba) {
  const minX = Math.max(0, Math.floor(x - strokeWidth - 2));
  const maxX = Math.min(size - 1, Math.ceil(x + width + strokeWidth + 2));
  const minY = Math.max(0, Math.floor(y - strokeWidth - 2));
  const maxY = Math.min(size - 1, Math.ceil(y + height + strokeWidth + 2));

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const distance = Math.abs(roundedRectDistance(px + 0.5, py + 0.5, x, y, width, height, radius));
      const coverage = smoothstep(strokeWidth / 2 + 1.2, strokeWidth / 2 - 1.2, distance);
      blendPixel(pixels, px, py, rgba, coverage);
    }
  }
}

function roundedRectDistance(px, py, x, y, width, height, radius) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const qx = Math.abs(px - cx) - width / 2 + radius;
  const qy = Math.abs(py - cy) - height / 2 + radius;
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  return Math.sqrt(outsideX * outsideX + outsideY * outsideY) + Math.min(Math.max(qx, qy), 0) - radius;
}

function drawCircle(pixels, cx, cy, radius, rgba) {
  const minX = Math.max(0, Math.floor(cx - radius - 2));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius + 2));
  const minY = Math.max(0, Math.floor(cy - radius - 2));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius + 2));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - radius;
      blendPixel(pixels, x, y, rgba, smoothstep(1.2, -1.2, distance));
    }
  }
}

function drawLine(pixels, x1, y1, x2, y2, width, rgba) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - width - 2));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + width + 2));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - width - 2));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + width + 2));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = lengthSquared === 0 ? 0 : clamp01(((x + 0.5 - x1) * dx + (y + 0.5 - y1) * dy) / lengthSquared);
      const projectedX = x1 + t * dx;
      const projectedY = y1 + t * dy;
      const distance = Math.hypot(x + 0.5 - projectedX, y + 0.5 - projectedY);
      const coverage = smoothstep(width / 2 + 1.2, width / 2 - 1.2, distance);
      blendPixel(pixels, x, y, rgba, coverage);
    }
  }
}

function encodePng(width, height, rgbaPixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawRow = y * (width * 4 + 1);
    const pixelRow = y * width * 4;
    raw[rawRow] = 0;
    Buffer.from(rgbaPixels.buffer, rgbaPixels.byteOffset + pixelRow, width * 4).copy(raw, rawRow + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", Buffer.concat([
      uint32be(width),
      uint32be(height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([
    uint32be(data.length),
    typeBuffer,
    data,
    uint32be(crc32(Buffer.concat([typeBuffer, data])))
  ]);
}

function readPngHeader(file) {
  const data = readFileSync(file);
  const signature = data.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error(`${file} is not a PNG file`);
  }
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    bitDepth: data[24],
    colorType: data[25]
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32be(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function writeJson(file, value) {
  ensureDir(dirname(file));
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
