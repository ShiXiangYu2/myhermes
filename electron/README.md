# Hermes Desktop

为 Hermes Agent 打造的桌面 GUI 客户端，灵感来自 Qclaw 的优秀设计。

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                      Hermes Desktop                     │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐         ┌──────────────────────┐  │
│  │   Main Process   │         │  Renderer Process    │  │
│  │   (Electron)     │   IPC   │  (React + Vite)      │  │
│  │                  │◄──────►│                      │  │
│  │  ┌────────────┐  │         │  ┌────────────────┐  │  │
│  │  │ CLI Service│  │         │  │  Web UI        │  │  │
│  │  │  hermes    │  │         │  │  Status/Config │  │  │
│  │  │  gateway   │  │         │  │  Platforms     │  │  │
│  │  └─────┬──────┘  │         │  └────────────────┘  │  │
│  │        │         │         │                      │  │
│  │  ┌─────▼──────┐  │         └──────────────────────┘  │
│  │  │  Tray/Menu │  │                                   │
│  │  │  Window    │  │                                   │
│  │  └────────────┘  │                                   │
│  └──────────────────┘                                   │
│                                                         │
│           │                                             │
│           ▼                                             │
│  ┌──────────────────┐                                   │
│  │  Hermes CLI      │                                   │
│  │  python *.py     │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 安装依赖

```bash
# 一键安装所有依赖
chmod +x scripts/setup-desktop.sh
./scripts/setup-desktop.sh
```

或手动安装：

```bash
# 根目录依赖
npm install

# Electron 依赖
cd electron && npm install && cd ..

# Web UI 依赖
cd web && npm install && cd ..
```

### 2. 启动开发模式

```bash
npm run desktop:dev
```

这将同时启动：
- Vite 开发服务器（Web UI）
- Electron 主进程

### 3. 构建生产版本

```bash
npm run desktop:build
```

### 4. 打包应用

```bash
# macOS
npm run package:mac

# Windows
npm run package:win

# Linux
npm run package:linux
```

## 项目结构

```
hermes-agent-main/
├── electron/                   # Electron 桌面壳
│   ├── main/
│   │   └── index.ts           # 主进程入口
│   ├── preload/
│   │   └── index.ts           # 安全桥接脚本
│   ├── package.json           # Electron 依赖
│   └── tsconfig.json          # TypeScript 配置
│
├── web/                       # Web UI（React + Vite）
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   │   ├── StatusPage.tsx
│   │   │   ├── ConfigPage.tsx
│   │   │   ├── PlatformsPage.tsx  # IM 平台管理（新增）
│   │   │   └── ...
│   │   ├── lib/
│   │   │   └── api.ts         # API 客户端（支持 Electron/HTTP）
│   │   └── App.tsx            # 主应用
│   └── package.json
│
├── vite.config.ts             # Vite + Electron 配置
├── package.json               # 根目录脚本和配置
└── scripts/
    └── setup-desktop.sh       # 安装脚本
```

## 核心功能

### 已移植的 Qclaw 特性

| 功能 | 状态 | 说明 |
|------|------|------|
| 平台管理 | ✅ | 飞书/钉钉/Telegram/Discord/Slack |
| 配置向导 | 🚧 | 分步骤引导配置 |
| 状态监控 | ✅ | 网关状态实时显示 |
| 系统托盘 | ✅ | 后台运行、快捷操作 |

### 平台接入向导设计

参考 Qclaw 的交互模式：

1. **选择平台** → 卡片式展示支持的平台
2. **分步引导** → 每个平台有定制化的配置步骤
3. **Token 输入** → 安全的密码输入框
4. **一键连接** → 自动写入配置并重启网关

## IPC 通信

主进程与渲染进程通过预加载脚本安全通信：

```typescript
// 渲染进程调用
window.hermes.getStatus()
window.hermes.startGateway()
window.hermes.setupPlatform('telegram')

// 主进程处理
ipcMain.handle('hermes:getStatus', async () => { ... })
ipcMain.handle('hermes:startGateway', async () => { ... })
```

## 双模式支持

Web UI 同时支持两种运行模式：

| 模式 | 环境 | 特性 |
|------|------|------|
| Electron | 桌面应用 | 完整功能（平台管理、网关控制） |
| Browser | 浏览器 | 受限功能（需 Hermes Web Server） |

检测方式：
```typescript
const isElectron = typeof window !== 'undefined' && !!(window as any).hermes;
```

## 下一步

1. [ ] 实现 CLI 服务封装（调用 hermes 命令）
2. [ ] 完善平台配置流程（对接真实 API）
3. [ ] 添加配置导入/导出
4. [ ] 实现自动更新
5. [ ] 移植 Qclaw 的更多交互细节

## 参考

- [Qclaw](https://github.com/qiuzhi2046/Qclaw) - OpenClaw GUI 桌面端
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) - 底层 Agent 框架
