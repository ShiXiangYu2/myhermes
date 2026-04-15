#!/bin/bash
# Hermes Agent 发布脚本

set -e

VERSION="1.0.0"
REPO="ShiXiangYu2/myhermes"

echo "🚀 Hermes Agent v${VERSION} 发布脚本"
echo "================================"

# 检查 GitHub Token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  警告: GITHUB_TOKEN 未设置"
    echo "请设置环境变量: export GITHUB_TOKEN=your_token"
    echo "或者在 GitHub 网页手动上传构建产物"
    echo ""
fi

# 检查构建产物
echo "📦 检查构建产物..."
if [ ! -f "dist/Hermes Desktop-${VERSION}.dmg" ]; then
    echo "❌ 错误: Intel Mac 构建产物不存在"
    exit 1
fi

if [ ! -f "dist/Hermes Desktop-${VERSION}-arm64.dmg" ]; then
    echo "❌ 错误: Apple Silicon 构建产物不存在"
    exit 1
fi

echo "✅ 构建产物检查通过"
echo ""

# 显示构建产物信息
echo "📋 构建产物:"
ls -lh dist/*.dmg
echo ""

# 如果设置了 GITHUB_TOKEN，自动创建 release
if [ -n "$GITHUB_TOKEN" ]; then
    echo "📝 创建 GitHub Release..."

    # 创建 release
    RELEASE_RESPONSE=$(curl -s -X POST \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: Bearer ${GITHUB_TOKEN}" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        https://api.github.com/repos/${REPO}/releases \
        -d "{
            \"tag_name\":\"v${VERSION}\",
            \"name\":\"Hermes Agent v${VERSION}\",
            \"body\":\"$(cat RELEASE_NOTES.md | sed 's/"/\\"/g' | tr '\n' ' ')\",
            \"draft\":false,
            \"prerelease\":false
        }")

    # 提取 release ID
    RELEASE_ID=$(echo $RELEASE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

    if [ -z "$RELEASE_ID" ]; then
        echo "❌ 创建 Release 失败"
        echo "响应: $RELEASE_RESPONSE"
        exit 1
    fi

    echo "✅ Release 创建成功 (ID: $RELEASE_ID)"
    echo ""

    # 上传构建产物
    echo "📤 上传构建产物..."

    for file in "dist/Hermes Desktop-${VERSION}.dmg" "dist/Hermes Desktop-${VERSION}-arm64.dmg"; do
        filename=$(basename "$file")
        echo "  上传: $filename"

        curl -s -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer ${GITHUB_TOKEN}" \
            -H "Content-Type: application/octet-stream" \
            "https://uploads.github.com/repos/${REPO}/releases/${RELEASE_ID}/assets?name=${filename}" \
            --data-binary "@$file" > /dev/null

        echo "  ✅ $filename 上传成功"
    done

    echo ""
    echo "🎉 发布完成!"
    echo "🔗 Release 地址: https://github.com/${REPO}/releases/tag/v${VERSION}"

else
    echo "📖 手动发布步骤:"
    echo ""
    echo "1. 访问 https://github.com/${REPO}/releases"
    echo "2. 点击 'Draft a new release'"
    echo "3. 选择标签: v${VERSION}"
    echo "4. 标题: Hermes Agent v${VERSION}"
    echo "5. 内容: 复制 RELEASE_NOTES.md 的内容"
    echo "6. 上传以下文件:"
    echo "   - dist/Hermes Desktop-${VERSION}.dmg"
    echo "   - dist/Hermes Desktop-${VERSION}-arm64.dmg"
    echo "7. 点击 'Publish release'"
    echo ""
    echo "📄 RELEASE_NOTES.md 已生成，包含完整的发布说明"
fi

echo ""
echo "✨ 完成!"
