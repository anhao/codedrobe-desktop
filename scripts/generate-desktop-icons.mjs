import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'assets');
const runtimeAssets = path.join(assets, 'runtime');
const source = path.join(assets, 'icon.svg');
const traySource = path.join(assets, 'trayTemplate.svg');
const themeFileSource = path.join(assets, 'theme-file.svg');
const work = await mkdtemp(path.join(os.tmpdir(), 'codedrobe-icons-'));

function render(input, size, output) {
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), input, '-o', output], {
    stdio: 'inherit',
  });
}

async function writeIco(entries, output) {
  const images = await Promise.all(entries.map(async ({ size, file }) => ({
    size,
    data: await readFile(file),
  })));
  const headerSize = 6 + images.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = headerSize;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });

  await writeFile(output, Buffer.concat([header, ...images.map(({ data }) => data)]));
}

try {
  await mkdir(runtimeAssets, { recursive: true });
  const png1024 = path.join(work, 'icon-1024.png');
  render(source, 1024, png1024);
  await copyFile(png1024, path.join(assets, 'icon.png'));
  await copyFile(png1024, path.join(runtimeAssets, 'icon.png'));

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoEntries = icoSizes.map((size) => ({ size, file: path.join(work, `icon-${size}.png`) }));
  for (const { size, file } of icoEntries) render(source, size, file);
  await writeIco(icoEntries, path.join(assets, 'icon.ico'));

  // .codedrobe-theme document icon (Windows file association).
  const themeIcoEntries = icoSizes.map((size) => ({ size, file: path.join(work, `theme-file-${size}.png`) }));
  for (const { size, file } of themeIcoEntries) render(themeFileSource, size, file);
  await writeIco(themeIcoEntries, path.join(assets, 'theme-file.ico'));

  render(traySource, 18, path.join(runtimeAssets, 'trayTemplate.png'));
  render(traySource, 36, path.join(runtimeAssets, 'trayTemplate@2x.png'));
  render(source, 32, path.join(runtimeAssets, 'tray-icon.png'));

  // PNG-payload ICNS chunks, written directly (same layout iconutil emits, so
  // no macOS-only toolchain is needed): base 16/32 slots plus the ic07..ic14
  // 128..1024 and retina slots.
  const icnsTypes = [
    ['icp4', 16],
    ['icp5', 32],
    ['ic11', 32],
    ['ic12', 64],
    ['ic07', 128],
    ['ic13', 256],
    ['ic08', 256],
    ['ic14', 512],
    ['ic09', 512],
    ['ic10', 1024],
  ];
  const writeIcns = async (svg, name, output) => {
    const chunks = [];
    for (const [type, size] of icnsTypes) {
      const file = path.join(work, `${name}-${type}.png`);
      render(svg, size, file);
      const data = await readFile(file);
      const header = Buffer.alloc(8);
      header.write(type, 0, 'ascii');
      header.writeUInt32BE(data.length + 8, 4);
      chunks.push(header, data);
    }
    const body = Buffer.concat(chunks);
    const fileHeader = Buffer.alloc(8);
    fileHeader.write('icns', 0, 'ascii');
    fileHeader.writeUInt32BE(body.length + 8, 4);
    await writeFile(output, Buffer.concat([fileHeader, body]));
  };
  await writeIcns(source, 'CodeDrobe', path.join(assets, 'icon.icns'));
  // .codedrobe-theme document icon (macOS CFBundleTypeIconFile).
  await writeIcns(themeFileSource, 'CodeDrobeThemeFile', path.join(assets, 'theme-file.icns'));

  console.log('Generated CodeDrobe PNG, ICO, tray, and macOS ICNS assets.');
} finally {
  await rm(work, { recursive: true, force: true });
}
