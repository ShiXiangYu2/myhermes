import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function SetupCheck() {
  const [checking, setChecking] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkInstallation();
  }, []);

  const checkInstallation = async () => {
    try {
      const result = await api.checkInstall();
      setInstalled(result.success);
      if (!result.success) {
        setError(result.error || "Hermes Agent 未安装");
      }
    } catch (err) {
      setInstalled(false);
      setError(err instanceof Error ? err.message : "检测失败");
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>检测 Hermes Agent 安装状态...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!installed) {
    return (
      <Card className="max-w-lg mx-auto mt-8 border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Hermes Agent 未安装
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {error || "未检测到 Hermes CLI，请先安装 Hermes Agent。"}
          </p>
          <div className="bg-muted p-4 rounded-md font-mono text-sm">
            <p className="text-muted-foreground mb-2"># 使用官方安装脚本</p>
            <p>curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash</p>
          </div>
          <button
            onClick={checkInstallation}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            重新检测
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto mt-8 border-success/50">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 text-success">
          <CheckCircle2 className="w-5 h-5" />
          <span>Hermes Agent 已安装</span>
        </div>
      </CardContent>
    </Card>
  );
}
