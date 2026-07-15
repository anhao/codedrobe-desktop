# CodeDrobe Desktop

[English](README.md)

官方网站：[codedrobe.app](https://codedrobe.app)

CodeDrobe Desktop 是一款开源的 Codex 主题管理软件，支持 macOS 和 Windows 上的官方 Codex 桌面应用。可以一键应用自定义 Codex 主题、导入导出主题包，并安全恢复原生界面。

![CodeDrobe Desktop 主题管理器与三个内置 Codex 主题](docs/images/desktop.png)

它提供主题管理、一键带主题启动、`.codex-theme` 导入导出、安全恢复，以及在页面跳转或渲染器重载后继续保持主题的托盘后台服务。

## 主要功能

- 内置 Dream / Fiona、Dilraba Rose 和 KUN Stage 三个主题，安装后即可使用。
- 导入、导出、管理和删除可移植的自定义 Codex 主题。
- 一键应用主题并启动官方 Codex 应用。
- 导入和导出可移植的 `.codex-theme` 文件。
- 安全恢复 Codex 原生界面。
- 通过系统托盘持续保持主题注入。
- 支持中文和英文切换；首次启动跟随系统的中文或英文设置，其他系统语言默认使用中文，之后保持用户选择。
- 支持 macOS 和 Windows，不要求用户单独安装 Node.js。

## Codex 主题效果

| KUN Stage | Dream / Fiona | Dilraba Rose |
| --- | --- | --- |
| ![Codex 桌面应用 KUN Stage 深色主题](docs/images/codex-01.png) | ![Codex 桌面应用 Dream Fiona 粉色主题](docs/images/codex-02.png) | ![Codex 桌面应用 Dilraba Rose 玫瑰主题](docs/images/codex-03.png) |

## 相关 Skill

主题创建、AI 定制、命令行工作流和共享主题格式由 [anhao/codedrobe-codex-skill](https://github.com/anhao/codedrobe-codex-skill) 维护。

## 本地开发

```bash
npm install
npm start
```

Desktop 使用保存在 `vendor/` 中的固定版本 `@codedrobe/codex-core` 包，因此本地开发和 CI 使用完全相同的 Core，不需要同时检出相邻仓库。

## 测试和打包

```bash
npm run check
npm run package
npm run make
```

- macOS 构建生成 DMG 和 ZIP。
- Windows 构建生成 Squirrel Setup 安装程序。
- 当前 CI 生成的是未签名测试包；正式公开分发前需要配置 Apple 签名、公证和 Windows 代码签名。

## 版本发布

只有推送 `v1.0.0` 这类语义化版本标签时，Desktop 才会触发发布构建。GitHub Actions 会先验证源码，再构建 macOS ARM64 和 Windows x64 安装包，创建对应的 GitHub Release，并将 DMG、ZIP、Setup 安装程序和 Squirrel 更新文件上传为 Release 制品。

```bash
git tag v1.0.0
git push origin v1.0.0
```

标签是发布版本号的唯一来源：`v1.0.0` 会生成应用版本 `1.0.0`。普通 push 和 Pull Request 不再构建可分发安装包。

Desktop 仓库：[anhao/codedrobe-desktop](https://github.com/anhao/codedrobe-desktop)

## 许可证

CodeDrobe Desktop 源代码使用 [Mozilla Public License 2.0](LICENSE)。如果对外分发修改后的版本，MPL 覆盖的源文件及其修改需要继续以 MPL 方式提供源码。

该协议不会授予 CodeDrobe 品牌或内置图片素材的使用权，具体参见 [TRADEMARKS.md](TRADEMARKS.md) 和 [ASSETS_LICENSE.md](ASSETS_LICENSE.md)。第三方组件继续使用各自协议，具体参见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
