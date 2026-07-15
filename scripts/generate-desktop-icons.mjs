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

  render(traySource, 18, path.join(runtimeAssets, 'trayTemplate.png'));
  render(traySource, 36, path.join(runtimeAssets, 'trayTemplate@2x.png'));
  render(source, 32, path.join(runtimeAssets, 'tray-icon.png'));

  if (process.platform === 'darwin') {
    const iconset = path.join(work, 'CodeDrobe.iconset');
    await mkdir(iconset);
    const icnsFiles = [
      ['icon_16x16.png', 16],
      ['icon_16x16@2x.png', 32],
      ['icon_32x32.png', 32],
      ['icon_32x32@2x.png', 64],
      ['icon_128x128.png', 128],
      ['icon_128x128@2x.png', 256],
      ['icon_256x256.png', 256],
      ['icon_256x256@2x.png', 512],
      ['icon_512x512.png', 512],
      ['icon_512x512@2x.png', 1024],
    ];
    for (const [filename, size] of icnsFiles) render(source, size, path.join(iconset, filename));
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(assets, 'icon.icns')], {
      stdio: 'inherit',
    });
  }

  console.log('Generated CodeDrobe PNG, ICO, tray, and macOS ICNS assets.');
} finally {
  await rm(work, { recursive: true, force: true });
}
