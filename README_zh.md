# CodeDrobe Desktop

[English](README.md)

官方网站：[codedrobe.app](https://codedrobe.app)

CodeDrobe Desktop 是一款面向普通用户的 Codex 主题管理软件，支持 macOS 和 Windows 上的官方 Codex 桌面应用。

它提供主题管理、一键带主题启动、`.codex-theme` 导入导出、安全恢复，以及在页面跳转或渲染器重载后继续保持主题的托盘后台服务。

## 主要功能

- 导入、导出、管理和删除可移植的 Codex 主题；Desktop 不再捆绑内置主题。
- 一键应用主题并启动官方 Codex 应用。
- 导入和导出可移植的 `.codex-theme` 文件。
- 安全恢复 Codex 原生界面。
- 通过系统托盘持续保持主题注入。
- 支持中文和英文切换；首次启动跟随系统的中文或英文设置，其他系统语言默认使用中文，之后保持用户选择。
- 支持 macOS 和 Windows，不要求用户单独安装 Node.js。

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

## 自动构建

GitHub Actions 会先在 Linux 上验证应用，然后构建 macOS ARM64 和 Windows x64 产物。工作流会在向 `main` 推送、向 `main` 提交 Pull Request、推送 `desktop-v*` 标签或手动触发时运行。

Desktop 仓库：[anhao/codedrobe-desktop](https://github.com/anhao/codedrobe-desktop)

## 许可证

CodeDrobe Desktop 源代码使用 [Mozilla Public License 2.0](LICENSE)。如果对外分发修改后的版本，MPL 覆盖的源文件及其修改需要继续以 MPL 方式提供源码。

该协议不会授予 CodeDrobe 品牌或内置图片素材的使用权，具体参见 [TRADEMARKS.md](TRADEMARKS.md) 和 [ASSETS_LICENSE.md](ASSETS_LICENSE.md)。第三方组件继续使用各自协议，具体参见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
