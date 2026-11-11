#!/usr/bin/env node

// Development-only export: the Android application does not depend on Sharp.
const fs = require("node:fs/promises");
const path = require("node:path");

const densitySizes = [
    ["mdpi", 108],
    ["hdpi", 162],
    ["xhdpi", 216],
    ["xxhdpi", 324],
    ["xxxhdpi", 432],
];

async function main() {
    const outputDirectory = process.argv[2];
    const sharpModule = process.env.HU090_SHARP_MODULE;
    if (!outputDirectory || !sharpModule) {
        throw new Error("Pass an output resource directory and HU090_SHARP_MODULE pointing to Sharp");
    }
    const sharp = require(sharpModule);
    const master = await fs.readFile(path.join(__dirname, "ic_launcher_monochrome.svg"), "utf8");
    if (!master.includes('width="108" height="108"')) {
        throw new Error("Expected the reviewed 108 dp monochrome master");
    }
    for (const [density, pixels] of densitySizes) {
        // Render each density directly from the vector; never resize a previous raster.
        const svg = master.replace('width="108" height="108"', `width="${pixels}" height="${pixels}"`);
        const target = path.join(outputDirectory, `drawable-${density}`, "ic_launcher_monochrome.png");
        await fs.mkdir(path.dirname(target), { recursive: true });
        await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: false }).toFile(target);
        process.stdout.write(`${density}: ${pixels}x${pixels}\n`);
    }
    process.stdout.write(`Renderer: ${JSON.stringify(sharp.versions)}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
