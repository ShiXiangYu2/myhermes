#!/bin/bash
# Hermes Desktop 安装脚本
# 一键安装 Electron 桌面端依赖

set -e

echo "🚀 设置 Hermes Desktop 开发环境..."

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Node.js 版本
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js 未安装${NC}"
        echo "请先安装 Node.js 22+："
        echo "  macOS: brew install node@22"
        echo "  其他: https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 22 ]; then
        echo -e "${YELLOW}⚠️ Node.js 版本过低 (当前: $(node -v))${NC}"
        echo "建议升级到 Node.js 22+ 以获得最佳体验"
    else
        echo -e "${GREEN}✅ Node.js $(node -v)${NC}"
    fi
}

# 安装根目录依赖
install_root_deps() {
    echo -e "\n📦 安装根目录依赖..."
    cd "$(dirname "$0")/.."
    npm install
}

# 安装 Electron 依赖
install_electron_deps() {
    echo -e "\n📦 安装 Electron 依赖..."
    cd "$(dirname "$0")/../electron"
    npm install
}

# 安装 Web UI 依赖
install_web_deps() {
    echo -e "\n📦 安装 Web UI 依赖..."
    cd "$(dirname "$0")/../web"
    npm install
}

# 构建 Electron
build_electron() {
    echo -e "\n🔨 构建 Electron..."
    cd "$(dirname "$0")/../electron"
    npm run build
}

# 主流程
main() {
    check_node
    install_root_deps
    install_electron_deps
    install_web_deps
    build_electron

    echo -e "\n${GREEN}✅ Hermes Desktop 设置完成！${NC}"
    echo ""
    echo "可用命令："
    echo "  npm run desktop:dev     # 启动开发模式"
    echo "  npm run desktop:build   # 构建生产版本"
    echo "  npm run package:mac     # 打包 macOS 应用"
    echo ""
    echo -e "${YELLOW}提示：确保你已经安装了 Hermes CLI${NC}"
    echo "  安装指南: https://hermes-agent.nousresearch.com/docs/"
}

main
