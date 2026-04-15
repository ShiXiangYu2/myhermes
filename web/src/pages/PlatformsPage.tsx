import { useEffect, useState } from "react";
import {
  MessageCircle,
  Send,
  Hash,
  Zap,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Settings,
  ExternalLink,
  AlertCircle,
  Loader2,
  Power
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// 平台配置
const PLATFORM_CONFIG: Record<string, {
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  setupSteps: string[];
  docsUrl?: string;
  tokenName: string;
  tokenPlaceholder: string;
}> = {
  telegram: {
    name: "Telegram",
    icon: Send,
    color: "#0088cc",
    description: "通过 Bot API 接入 Telegram，支持私聊和群组",
    docsUrl: "https://core.telegram.org/bots",
    setupSteps: [
      "在 Telegram 中搜索 @BotFather",
      "发送 /newbot 创建新机器人",
      "获取 Bot Token (格式: 123456:ABC-DEF...)",
      "输入 Token 完成配置"
    ],
    tokenName: "Bot Token",
    tokenPlaceholder: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
  },
  discord: {
    name: "Discord",
    icon: Hash,
    color: "#5865F2",
    description: "通过 Discord Bot Token 接入 Discord 服务器",
    docsUrl: "https://discord.com/developers/applications",
    setupSteps: [
      "访问 Discord Developer Portal",
      "创建 New Application",
      "进入 Bot 页面，点击 Add Bot",
      "复制 Token 完成配置"
    ],
    tokenName: "Bot Token",
    tokenPlaceholder: "MTAxMDEw..."
  },
  slack: {
    name: "Slack",
    icon: MessageSquare,
    color: "#4A154B",
    description: "通过 Slack App 接入工作区",
    docsUrl: "https://api.slack.com/apps",
    setupSteps: [
      "访问 Slack API 页面",
      "Create New App",
      "进入 OAuth & Permissions",
      "添加 Bot Token Scopes",
      "安装应用到工作区"
    ],
    tokenName: "Bot User OAuth Token",
    tokenPlaceholder: "xoxb-..."
  },
  feishu: {
    name: "飞书",
    icon: Zap,
    color: "#3370FF",
    description: "通过飞书自建应用接入企业微信",
    docsUrl: "https://open.feishu.cn/app/",
    setupSteps: [
      "访问飞书开放平台",
      "创建企业自建应用",
      "开通机器人能力",
      "获取 App ID 和 Secret"
    ],
    tokenName: "App Secret",
    tokenPlaceholder: "输入飞书 App Secret"
  },
  dingtalk: {
    name: "钉钉",
    icon: MessageCircle,
    color: "#1677FF",
    description: "通过钉钉机器人接入企业内部群",
    docsUrl: "https://open.dingtalk.com/document/",
    setupSteps: [
      "进入钉钉开放平台",
      "创建企业内部应用",
      "添加机器人能力",
      "获取 webhook 地址"
    ],
    tokenName: "Webhook Token",
    tokenPlaceholder: "输入钉钉 Webhook Token"
  },
};

interface Platform {
  id: string;
  name: string;
  enabled: boolean;
  state?: 'connected' | 'disconnected' | 'error' | 'unknown' | string;
  errorMessage?: string;
}

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState(0);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPlatforms();
  }, []);

  // 自动隐藏成功/错误消息
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  const loadPlatforms = async () => {
    setLoading(true);
    try {
      const data = await api.getPlatforms();
      setPlatforms(data);
    } catch (err) {
      console.error("Failed to load platforms:", err);
      setError("加载平台列表失败");
      // 使用默认数据
      setPlatforms([
        { id: "telegram", name: "Telegram", enabled: false, state: 'unknown' },
        { id: "discord", name: "Discord", enabled: false, state: 'unknown' },
        { id: "slack", name: "Slack", enabled: false, state: 'unknown' },
        { id: "feishu", name: "飞书", enabled: false, state: 'unknown' },
        { id: "dingtalk", name: "钉钉", enabled: false, state: 'unknown' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = (platformId: string) => {
    setSelectedPlatform(platformId);
    setSetupStep(0);
    setToken("");
    setError(null);
  };

  const completeSetup = async () => {
    if (!selectedPlatform || !token.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const result = await api.setupPlatform(selectedPlatform, {
        token: token.trim(),
        enabled: 'true'
      });

      if (result.success) {
        setSelectedPlatform(null);
        setSuccessMessage(`${PLATFORM_CONFIG[selectedPlatform].name} 配置成功，网关已重启`);
        await loadPlatforms();
      } else {
        setError(result.error || "配置失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "配置过程中发生错误");
    } finally {
      setSaving(false);
    }
  };

  const disablePlatform = async (platformId: string) => {
    if (!confirm(`确定要断开 ${PLATFORM_CONFIG[platformId].name} 的连接吗？`)) {
      return;
    }

    setSaving(true);
    try {
      // 禁用平台（通过设置 enabled: false）
      const result = await api.setupPlatform(platformId, {
        token: '',
        enabled: 'false'
      });

      if (result.success) {
        setSuccessMessage(`${PLATFORM_CONFIG[platformId].name} 已断开连接`);
        await loadPlatforms();
      } else {
        setError(result.error || "操作失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作过程中发生错误");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // 设置向导弹窗
  if (selectedPlatform) {
    const config = PLATFORM_CONFIG[selectedPlatform];
    const Icon = config.icon;
    const isLastStep = setupStep === config.setupSteps.length - 1;

    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Icon className="w-8 h-8" style={{ color: config.color }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">连接 {config.name}</h1>
            <p className="text-muted-foreground">{config.description}</p>
          </div>
        </div>

        {/* 进度指示器 */}
        <div className="flex gap-2">
          {config.setupSteps.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 flex-1 rounded-full transition-colors ${
                idx <= setupStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center">
                {setupStep + 1}
              </span>
              步骤 {setupStep + 1} / {config.setupSteps.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">{config.setupSteps[setupStep]}</p>

            {config.docsUrl && setupStep === 0 && (
              <a
                href={config.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                查看官方文档
              </a>
            )}

            {isLastStep && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {config.tokenName}
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={config.tokenPlaceholder}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background font-mono text-sm"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Token 将安全地存储在本地环境变量中
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {setupStep > 0 && (
                <button
                  onClick={() => setSetupStep(s => s - 1)}
                  disabled={saving}
                  className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                >
                  上一步
                </button>
              )}

              {!isLastStep ? (
                <button
                  onClick={() => setSetupStep(s => s + 1)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  下一步
                </button>
              ) : (
                <button
                  onClick={completeSetup}
                  disabled={!token.trim() || saving}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? '保存中...' : '完成配置'}
                </button>
              )}

              <button
                onClick={() => setSelectedPlatform(null)}
                disabled={saving}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors ml-auto disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">消息平台</h1>
          <p className="text-muted-foreground mt-1">
            配置 IM 平台，让 Hermes 可以通过消息应用与你交互
          </p>
        </div>
        <button
          onClick={loadPlatforms}
          disabled={loading}
          className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '刷新'}
        </button>
      </div>

      {/* 全局消息 */}
      {successMessage && (
        <div className="flex items-center gap-2 text-success text-sm p-3 bg-success/10 rounded-md">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform) => {
          const config = PLATFORM_CONFIG[platform.id];
          const Icon = config.icon;

          return (
            <Card key={platform.id} className="group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${config.color}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: config.color }} />
                  </div>
                  <Badge
                    variant={platform.enabled ? "success" : "outline"}
                    className={platform.state === 'error' ? 'border-destructive text-destructive' : ''}
                  >
                    {platform.enabled ? (
                      platform.state === 'error' ? (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          错误
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          已连接
                        </>
                      )
                    ) : (
                      "未连接"
                    )}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-3">{config.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {config.description}
                </p>

                {platform.state === 'error' && platform.errorMessage && (
                  <div className="flex items-center gap-2 text-destructive text-sm mb-4 p-2 bg-destructive/10 rounded">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {platform.errorMessage}
                  </div>
                )}

                <div className="flex gap-2">
                  {platform.enabled ? (
                    <>
                      <button
                        onClick={() => startSetup(platform.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        重新配置
                      </button>
                      <button
                        onClick={() => disablePlatform(platform.id)}
                        disabled={saving}
                        className="px-3 py-2 border border-destructive/50 text-destructive rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="断开连接"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startSetup(platform.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      连接
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">关于消息平台</h3>
              <p className="text-sm text-muted-foreground mt-1">
                配置完成后，你可以直接在 Telegram、Discord 等应用中与 Hermes 对话。
                配置更改后网关会自动重启以应用新设置。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
