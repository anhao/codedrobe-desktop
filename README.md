# CodeDrobe Desktop

[Chinese](README_zh.md)

Website: [codedrobe.app](https://codedrobe.app)

CodeDrobe Desktop is a beginner-friendly theme manager for the official Codex desktop app on macOS and Windows.

It provides theme management, one-click themed launch, `.codex-theme` import and export, safe restore, and a background tray watcher that keeps the selected theme active after navigation or renderer reloads.

## Features

- Import, export, organize, and delete portable Codex themes. Desktop ships without bundled themes.
- Apply a theme and launch the official Codex app with one click.
- Import and export portable `.codex-theme` files.
- Restore the original Codex appearance safely.
- Keep theme injection active from the system tray.
- Switch between Chinese and English. The first launch follows an English or Chinese system locale and falls back to Chinese for other locales; later launches keep the user's choice.
- Run on macOS and Windows without requiring a separate Node.js installation.

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

## Continuous integration

The GitHub Actions workflow validates the application on Linux, then builds macOS ARM64 and Windows x64 artifacts. It runs on pushes and pull requests to `main`, `desktop-v*` tags, and manual dispatches.

Repository: [anhao/codedrobe-desktop](https://github.com/anhao/codedrobe-desktop)

## License

CodeDrobe Desktop source code is licensed under the [Mozilla Public License 2.0](LICENSE). If you distribute a modified build, the MPL-covered source files and your modifications to those files must remain available under the MPL.

The license does not grant rights to CodeDrobe branding or bundled artwork. See [TRADEMARKS.md](TRADEMARKS.md) and [ASSETS_LICENSE.md](ASSETS_LICENSE.md). Third-party components remain under their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
