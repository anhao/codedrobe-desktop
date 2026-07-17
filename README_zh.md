# CodeDrobe Desktop — AI 桌面应用主题管理器

[![最新版本](https://img.shields.io/github/v/release/CodeDrobe/desktop?display_name=tag&sort=semver)](https://github.com/CodeDrobe/desktop/releases/latest)
[![版本构建](https://github.com/CodeDrobe/desktop/actions/workflows/build.yml/badge.svg)](https://github.com/CodeDrobe/desktop/actions/workflows/build.yml)
[![下载量](https://img.shields.io/github/downloads/CodeDrobe/desktop/total)](https://github.com/CodeDrobe/desktop/releases)
[![许可证 MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![macOS 与 Windows](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-6f4d62)](https://github.com/CodeDrobe/desktop/releases)

[English](README.md)

官方网站：[codedrobe.app](https://codedrobe.app) · [下载最新版本](https://github.com/CodeDrobe/desktop/releases/latest)

CodeDrobe Desktop 是一款面向 AI 桌面应用的开源主题管理器，目前支持 **OpenAI Codex** 和 **WorkBuddy**，运行于 macOS 和 Windows。在应用内浏览 CodeDrobe 主题商店、一键把主题应用到任意受支持的应用，并可随时恢复原生界面。主题只改变外观，不会修改应用安装包和你的数据。

![CodeDrobe Desktop 主题管理器](docs/images/desktop.png)

## v2 新特性

v2 是一次彻底重构：

- **全新 UI**：基于 Tailwind CSS + shadcn 风格组件，与 [codedrobe.app](https://codedrobe.app) 共享同一套设计语言。
- **多应用支持**：换用新的 `@codedrobe/core` 引擎，一个主题包可以适配多个应用，详情抽屉里按应用逐个应用（Codex、WorkBuddy）。
- **CodeDrobe 账号登录**：通过系统浏览器完成 OAuth 2.0 PKCE 授权，支持喜欢主题、同步的**收藏**列表和分享。
- **深度链接**：网页上的 `codedrobe://themes/apply?theme=<slug>&app=<id>` 链接会在应用内确认后自动安装并应用主题。
- **设置弹窗**：分类式设置——界面语言、手动指定应用安装位置、按应用配置调试端口、软件更新。
- **更聪明的应用流程**：应用已带调试连接运行时直接热替换主题；只有首次需要拉起应用或宿主外观设置变化时才要求重启。

## 主要功能

- 在线浏览中英文分类与免费主题，支持搜索、排序和按应用筛选。
- 识别已安装主题的新版本并直接覆盖更新。
- 每次下载都先与市场记录中的 SHA-256 校验值核对，再导入本地。
- 登录 CodeDrobe 账号即可喜欢主题、查看收藏；发布主题和编辑资料一键跳转网页完成。
- 在详情抽屉中把主题应用到指定应用——运行中的应用直接热切换，未运行的带主题启动。
- 从侧边栏应用状态列表或系统托盘恢复任意应用的原生界面。
- 导入、导出可移植的 `.codedrobe-theme` 主题包（旧版 `.codex-theme` 文件导入时自动转换）。
- 自动检测不到应用时可手动指定安装位置（主要是 Windows），默认调试端口被占用时可按应用修改。
- 支持中文和英文切换；首次启动跟随系统语言。
- 从 GitHub Releases 检测新版本，并在软件内下载对应安装包。

## Codex 主题效果

| KUN Stage | Dream / Fiona | Dilraba Rose |
| --- | --- | --- |
| ![Codex 桌面应用 KUN Stage 深色主题](docs/images/codex-01.png) | ![Codex 桌面应用 Dream Fiona 粉色主题](docs/images/codex-02.png) | ![Codex 桌面应用 Dilraba Rose 玫瑰主题](docs/images/codex-03.png) |

## 账号与权限

登录会打开系统浏览器完成 OAuth 2.0 授权码 + PKCE 流程，应用永远接触不到你的密码。申请的权限会在授权确认页逐项列出，之后可随时在网站的「已授权应用」页面撤销。刷新令牌使用操作系统钥匙串加密存储（Electron `safeStorage`）。

## 深度链接

网站上的"在应用中打开"使用 `codedrobe://` 协议，每次请求都会先弹出确认框，确认后才会安装或应用主题。macOS 上协议由打包版应用注册；开发期用启动参数模拟：

```bash
npm start -- -- "codedrobe://themes/apply?theme=<slug>&app=codex"
```

## 本地开发

```bash
npm install
npm start
```

如需连接本地网站实例：`CODEDROBE_API_BASE=http://localhost:4173 npm start`。

Desktop 使用保存在 `vendor/` 中的固定版本 `@codedrobe/core` 包，因此本地开发和 CI 使用完全相同的 Core，不需要同时检出相邻仓库。

## 测试和打包

```bash
npm run check
npm run package
npm run make
npm run make:windows:installers
```

- macOS 构建生成 DMG 和 ZIP。
- Windows 发布构建会同时生成 WiX MSI 安装包、NSIS Setup 安装程序和 Portable 免安装程序。在 Windows 上执行 `npm run make:windows:installers` 前，需要先运行 `npm run make -- --arch=x64`，生成打包后的应用目录和 MSI。

## 相关项目

- [CodeDrobe/core](https://github.com/CodeDrobe/core) —— Desktop 与 Skill 共用的 Apache-2.0 主题引擎和 `codedrobe` CLI（主题格式、应用适配器、应用/恢复）。
- [CodeDrobe/skills](https://github.com/CodeDrobe/skills) —— 在编码智能体里创建与定制主题的 AI 技能。

## 许可证

CodeDrobe Desktop 源代码使用 [Mozilla Public License 2.0](LICENSE)。如果对外分发修改后的版本，MPL 覆盖的源文件及其修改需要继续以 MPL 方式提供源码。

该协议不会授予 CodeDrobe 品牌或内置图片素材的使用权，具体参见 [TRADEMARKS.md](TRADEMARKS.md) 和 [ASSETS_LICENSE.md](ASSETS_LICENSE.md)。第三方组件继续使用各自协议，具体参见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
