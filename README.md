# CodeDrobe Desktop

[Chinese](README_zh.md)

Website: [codedrobe.app](https://codedrobe.app)

CodeDrobe Desktop is an open-source Codex theme manager for the official Codex desktop app on macOS and Windows. Apply custom Codex themes with one click, import or export portable theme packages, and safely restore the native interface.

![CodeDrobe Desktop theme manager showing three built-in Codex themes](docs/images/desktop.png)

It provides theme management, one-click themed launch, `.codex-theme` import and export, safe restore, and a background tray watcher that keeps the selected theme active after navigation or renderer reloads.

## Features

- Start with three built-in themes: Dream / Fiona, Dilraba Rose, and KUN Stage.
- Import, export, organize, and delete portable custom Codex themes.
- Apply a theme and launch the official Codex app with one click.
- Import and export portable `.codex-theme` files.
- Restore the original Codex appearance safely.
- Keep theme injection active from the system tray.
- Switch between Chinese and English. The first launch follows an English or Chinese system locale and falls back to Chinese for other locales; later launches keep the user's choice.
- Run on macOS and Windows without requiring a separate Node.js installation.

## Codex theme gallery

| KUN Stage | Dream / Fiona | Dilraba Rose |
| --- | --- | --- |
| ![Dark KUN Stage custom theme for the Codex desktop app](docs/images/codex-01.png) | ![Pink Dream Fiona custom theme for the Codex desktop app](docs/images/codex-02.png) | ![Rose Dilraba custom theme for the Codex desktop app](docs/images/codex-03.png) |

## Related Skill

Theme creation, AI customization, command-line workflows, and the shared theme format are maintained in [anhao/codedrobe-codex-skill](https://github.com/anhao/codedrobe-codex-skill).

## Local development

```bash
npm install
npm start
```

The Desktop app uses the pinned `@codedrobe/codex-core` package stored in `vendor/`. Development and CI therefore use the same Core version without requiring a sibling repository checkout.

## Test and package

```bash
npm run check
npm run package
npm run make
```

- macOS builds produce DMG and ZIP artifacts.
- Windows builds produce a Squirrel Setup executable.
- Current CI artifacts are unsigned and intended for testing. Public distribution will require Apple signing/notarization and Windows code signing.

## Releases

Desktop packages are built only when a semantic version tag such as `v1.0.0` is pushed. GitHub Actions validates the source, builds macOS ARM64 and Windows x64 packages, creates the matching GitHub Release, and uploads the DMG, ZIP, Setup executable, and Squirrel update files as release assets.

```bash
git tag v1.0.0
git push origin v1.0.0
```

The tag is the release version source: a `v1.0.0` tag produces application version `1.0.0`. Regular pushes and pull requests do not build distributable desktop packages.

Repository: [anhao/codedrobe-desktop](https://github.com/anhao/codedrobe-desktop)

## License

CodeDrobe Desktop source code is licensed under the [Mozilla Public License 2.0](LICENSE). If you distribute a modified build, the MPL-covered source files and your modifications to those files must remain available under the MPL.

The license does not grant rights to CodeDrobe branding or bundled artwork. See [TRADEMARKS.md](TRADEMARKS.md) and [ASSETS_LICENSE.md](ASSETS_LICENSE.md). Third-party components remain under their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
