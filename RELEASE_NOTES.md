# Hermes Agent v1.0.0 正式发布

## 主要特性

- **桌面应用程序** - 完整的 macOS 桌面应用（支持 Intel 和 Apple Silicon）
- **Web UI 界面** - 现代化的 React + Tailwind CSS 界面
- **多平台消息网关** - 支持 Telegram、Discord、Slack、飞书、钉钉等
- **自改进 AI 代理** - 从经验中创建技能，使用时自我改进
- **MCP 集成** - 支持 Model Context Protocol 扩展
- **定时任务** - 内置 Cron 调度器

## 构建产物

| 文件 | 架构 | 大小 |
|------|------|------|
| Hermes Desktop-1.0.0.dmg | Intel Mac (x64) | 131 MB |
| Hermes Desktop-1.0.0-arm64.dmg | Apple Silicon (arm64) | 127 MB |

## 安装说明

### macOS

1. 下载对应架构的 DMG 文件
2. 双击打开 DMG
3. 将 "Hermes Desktop" 拖动到 Applications 文件夹
4. 首次运行时，前往 **系统设置 > 隐私与安全性** 中允许应用运行

## 修复的问题

### TypeScript 编译错误
- `web/src/lib/api.ts` - 删除重复的属性定义
- `web/src/pages/PlatformsPage.tsx` - 修复未使用变量和类型不匹配
- `web/src/pages/StatusPage.tsx` - 修复未使用变量
- `electron/main/index.ts` - 修复 `nativeImage.NativeImage` 类型

### 测试修复
- `tests/tools/test_interrupt.py` - 修复线程安全测试，正确传递 `thread_id`
- `tests/cli/test_cli_interrupt_subagent.py` - 添加缺失的 `_execution_thread_id` 属性

## 系统要求

- macOS 10.12 或更高版本
- 4GB RAM 最低
- 500MB 可用磁盘空间

## 快速开始

```bash
# 启动桌面应用
/Applications/Hermes\ Desktop.app/Contents/MacOS/Hermes\ Desktop

# 或使用命令行
hermes
```

## 配置

首次启动时会自动创建配置文件：
- 配置文件：`~/.hermes/config.yaml`
- 环境变量：`~/.hermes/.env`

## 更多信息

- 文档：https://hermes-agent.nousresearch.com/docs/
- 问题反馈：https://github.com/ShiXiangYu2/myhermes/issues
- 社区：https://discord.gg/NousResearch

---

Built with ❤️ by Nous Research
