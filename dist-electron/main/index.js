"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const node_fs = require("node:fs");
const node_url = require("node:url");
const path = require("node:path");
const node_child_process = require("node:child_process");
const node_util = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
const execFileAsync = node_util.promisify(node_child_process.execFile);
class CLIService {
  constructor() {
    __publicField(this, "hermesCommand", null);
    __publicField(this, "config", null);
  }
  // 初始化：检测 hermes CLI
  async initialize() {
    try {
      const hermesPath = await this.findHermesCommand();
      if (!hermesPath) {
        return {
          success: false,
          error: "未找到 hermes 命令。请先安装 Hermes Agent。"
        };
      }
      this.hermesCommand = hermesPath;
      const hermesHome = process.env.HERMES_HOME || path.join(os.homedir(), ".hermes");
      this.config = {
        hermesHome,
        configPath: path.join(hermesHome, "config.yaml"),
        envPath: path.join(hermesHome, ".env")
      };
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "初始化失败"
      };
    }
  }
  // 查找 hermes 命令
  async findHermesCommand() {
    const candidates = [
      "hermes",
      path.join(os.homedir(), ".local/bin/hermes"),
      path.join(os.homedir(), ".hermes/bin/hermes")
    ];
    for (const cmd of candidates) {
      try {
        await execFileAsync(cmd, ["--version"]);
        return cmd;
      } catch {
        continue;
      }
    }
    try {
      const { stdout } = await execFileAsync("which", ["hermes"]);
      if (stdout.trim()) return stdout.trim();
    } catch {
    }
    return null;
  }
  // 执行 hermes 命令
  async runHermes(args, options = {}) {
    if (!this.hermesCommand) {
      return { success: false, stdout: "", stderr: "", error: "Hermes CLI 未初始化" };
    }
    return new Promise((resolve) => {
      var _a, _b;
      const child = node_child_process.spawn(this.hermesCommand, args, {
        env: { ...process.env, ...this.getHermesEnv() }
      });
      let stdout = "";
      let stderr = "";
      let timeoutId = null;
      (_a = child.stdout) == null ? void 0 : _a.on("data", (data) => {
        stdout += data.toString();
      });
      (_b = child.stderr) == null ? void 0 : _b.on("data", (data) => {
        stderr += data.toString();
      });
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          child.kill();
          resolve({ success: false, stdout, stderr, error: "命令执行超时" });
        }, options.timeout);
      }
      child.on("close", (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          error: code !== 0 ? stderr.trim() || `命令退出码: ${code}` : void 0
        });
      });
      child.on("error", (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve({ success: false, stdout, stderr, error: err.message });
      });
    });
  }
  getHermesEnv() {
    var _a;
    return {
      HERMES_HOME: ((_a = this.config) == null ? void 0 : _a.hermesHome) || path.join(os.homedir(), ".hermes")
    };
  }
  // 获取状态
  async getStatus() {
    var _a, _b;
    let version = "unknown";
    try {
      const { stdout } = await this.runHermes(["--version"], { timeout: 5e3 });
      const match = stdout.match(/hermes[\s/]+v?(\d+\.\d+\.?\d*)/i);
      version = (match == null ? void 0 : match[1]) || stdout.trim() || "unknown";
    } catch {
    }
    const gatewayStatus = await this.checkGatewayStatus();
    return {
      version,
      gatewayRunning: gatewayStatus.running,
      gatewayPid: gatewayStatus.pid,
      activeSessions: gatewayStatus.sessions,
      configPath: ((_a = this.config) == null ? void 0 : _a.configPath) || "",
      hermesHome: ((_b = this.config) == null ? void 0 : _b.hermesHome) || ""
    };
  }
  async checkGatewayStatus() {
    var _a;
    try {
      if ((_a = this.config) == null ? void 0 : _a.hermesHome) {
        const pidFile = path.join(this.config.hermesHome, "gateway.pid");
        try {
          const pidStr = await fs.readFile(pidFile, "utf-8");
          const pid = parseInt(pidStr.trim(), 10);
          if (!isNaN(pid)) {
            try {
              process.kill(pid, 0);
              return { running: true, pid, sessions: 0 };
            } catch {
            }
          }
        } catch {
        }
      }
      const { success, stdout } = await this.runHermes(["gateway", "status"], { timeout: 5e3 });
      if (success) {
        const running = stdout.includes("running") || stdout.includes("Running");
        const pidMatch = stdout.match(/PID[:\s]+(\d+)/i);
        return {
          running,
          pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
          sessions: 0
        };
      }
    } catch {
    }
    return { running: false, pid: null, sessions: 0 };
  }
  // 网关控制
  async startGateway() {
    const { success, error } = await this.runHermes(["gateway", "start", "--daemon"], { timeout: 1e4 });
    if (!success) return { success: false, error: error || "启动网关失败" };
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const status = await this.checkGatewayStatus();
      if (status.running) return { success: true };
    }
    return { success: false, error: "网关启动超时" };
  }
  async stopGateway() {
    const { success, error } = await this.runHermes(["gateway", "stop"], { timeout: 1e4 });
    if (!success) return { success: false, error: error || "停止网关失败" };
    return { success: true };
  }
  async restartGateway() {
    await this.stopGateway();
    await new Promise((r) => setTimeout(r, 1e3));
    return this.startGateway();
  }
  // 配置管理
  async getConfig() {
    var _a;
    try {
      if (!((_a = this.config) == null ? void 0 : _a.configPath)) return {};
      const content = await fs.readFile(this.config.configPath, "utf-8");
      const result = {};
      for (const line of content.split("\n")) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          result[key] = value.trim().replace(/^["']|["']$/g, "");
        }
      }
      return result;
    } catch {
      return {};
    }
  }
  async setConfig(key, value) {
    const valueStr = typeof value === "object" ? JSON.stringify(value) : String(value);
    const { success, error } = await this.runHermes(["config", "set", key, valueStr], { timeout: 5e3 });
    if (!success) return { success: false, error: error || "设置配置失败" };
    return { success: true };
  }
  // 平台管理
  async getPlatforms() {
    const platforms = [
      { id: "telegram", name: "Telegram", enabled: false, state: "unknown" },
      { id: "discord", name: "Discord", enabled: false, state: "unknown" },
      { id: "slack", name: "Slack", enabled: false, state: "unknown" },
      { id: "feishu", name: "飞书", enabled: false, state: "unknown" },
      { id: "dingtalk", name: "钉钉", enabled: false, state: "unknown" },
      { id: "matrix", name: "Matrix", enabled: false, state: "unknown" },
      { id: "signal", name: "Signal", enabled: false, state: "unknown" },
      { id: "whatsapp", name: "WhatsApp", enabled: false, state: "unknown" }
    ];
    const config = await this.getConfig();
    for (const platform of platforms) {
      const platformConfig = config[platform.id];
      const envEnabled = await this.checkEnvVar(`${platform.id.toUpperCase()}_TOKEN`);
      platform.enabled = !!(platformConfig == null ? void 0 : platformConfig.enabled) || envEnabled;
      platform.state = platform.enabled ? "disconnected" : "unknown";
    }
    return platforms;
  }
  async checkEnvVar(key) {
    var _a;
    try {
      if (!((_a = this.config) == null ? void 0 : _a.envPath)) return false;
      const content = await fs.readFile(this.config.envPath, "utf-8");
      return content.includes(`${key}=`);
    } catch {
      return false;
    }
  }
  async setPlatformToken(platform, token) {
    var _a;
    const envKey = `${platform.toUpperCase()}_TOKEN`;
    try {
      if (!((_a = this.config) == null ? void 0 : _a.envPath)) return { success: false, error: "环境变量路径未初始化" };
      let content = "";
      try {
        content = await fs.readFile(this.config.envPath, "utf-8");
      } catch {
      }
      const lines = content.split("\n");
      const newLine = `${envKey}=${token}`;
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(`${envKey}=`)) {
          lines[i] = newLine;
          found = true;
          break;
        }
      }
      if (!found) lines.push(newLine);
      await fs.mkdir(path.dirname(this.config.envPath), { recursive: true });
      await fs.writeFile(this.config.envPath, lines.join("\n"), "utf-8");
      await this.setConfig(`${platform}.enabled`, true);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "设置平台 Token 失败" };
    }
  }
  async setupPlatform(platform, config) {
    try {
      if (config.token) {
        const result = await this.setPlatformToken(platform, config.token);
        if (!result.success) return result;
      }
      for (const [key, value] of Object.entries(config)) {
        if (key !== "token") {
          await this.setConfig(`${platform}.${key}`, value);
        }
      }
      return this.restartGateway();
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "平台配置失败" };
    }
  }
}
const cliService = new CLIService();
const __dirname$1 = path.dirname(node_url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("index.js", document.baseURI).href));
const MAIN_DIST = path.join(__dirname$1, "../..");
const RENDERER_DIST = path.join(MAIN_DIST, "dist-web");
const IS_DEV = process.env.VITE_DEV_SERVER_URL || !electron.app.isPackaged;
process.env.VITE_PUBLIC = IS_DEV ? path.join(MAIN_DIST, "../web/public") : RENDERER_DIST;
if (!electron.app.requestSingleInstanceLock()) {
  electron.app.quit();
  process.exit(0);
}
let win = null;
let tray = null;
let isQuitting = false;
let cliInitialized = false;
const preload = path.join(__dirname$1, "../preload/index.mjs");
const indexHtml = path.join(RENDERER_DIST, "index.html");
function resolveAppIcon() {
  if (process.platform === "win32") {
    return path.join(process.env.VITE_PUBLIC, "favicon.ico");
  }
  return path.join(process.env.VITE_PUBLIC, "icon.png");
}
function loadRuntimeAppIcon() {
  const iconPath = resolveAppIcon();
  if (!node_fs.existsSync(iconPath)) return null;
  const icon = electron.nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? null : icon;
}
function createWindow() {
  electron.screen.getPrimaryDisplay().workAreaSize;
  const browserWindow = new electron.BrowserWindow({
    title: "Hermes Desktop",
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win = browserWindow;
  if (process.platform === "darwin") {
    const dockIcon = loadRuntimeAppIcon();
    if (dockIcon) {
      electron.app.dock.setIcon(dockIcon);
    }
  }
  browserWindow.once("ready-to-show", () => {
    browserWindow.show();
    if (IS_DEV) {
      browserWindow.webContents.openDevTools({ mode: "detach" });
    }
  });
  browserWindow.on("closed", () => {
    win = null;
  });
  browserWindow.on("close", (event) => {
    if (process.platform !== "darwin" || isQuitting) return;
    event.preventDefault();
    browserWindow.hide();
  });
  if (IS_DEV && process.env.VITE_DEV_SERVER_URL) {
    browserWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    browserWindow.loadFile(indexHtml);
  }
  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      electron.shell.openExternal(url);
    }
    return { action: "deny" };
  });
  return browserWindow;
}
function showMainWindow() {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  } else {
    createWindow();
  }
}
function createTray() {
  const iconPath = path.join(process.env.VITE_PUBLIC, "tray.png");
  let trayIcon;
  try {
    trayIcon = electron.nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = electron.nativeImage.createEmpty();
    }
  } catch {
    trayIcon = electron.nativeImage.createEmpty();
  }
  if (process.platform === "darwin") {
    trayIcon.setTemplateImage(true);
  }
  tray = new electron.Tray(trayIcon);
  tray.setToolTip("Hermes Desktop");
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "显示窗口",
      click: showMainWindow
    },
    { type: "separator" },
    {
      label: "配置模型",
      click: () => {
        showMainWindow();
        win == null ? void 0 : win.webContents.send("navigate", "config");
      }
    },
    {
      label: "网关状态",
      click: () => {
        showMainWindow();
        win == null ? void 0 : win.webContents.send("navigate", "status");
      }
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", showMainWindow);
}
electron.ipcMain.handle("hermes:checkInstall", async () => {
  const result = await cliService.initialize();
  cliInitialized = result.success;
  return result;
});
electron.ipcMain.handle("hermes:getStatus", async () => {
  if (!cliInitialized) {
    const init = await cliService.initialize();
    if (!init.success) return { error: init.error };
    cliInitialized = true;
  }
  return cliService.getStatus();
});
electron.ipcMain.handle("hermes:startGateway", async () => {
  if (!cliInitialized) return { success: false, error: "CLI 未初始化" };
  return cliService.startGateway();
});
electron.ipcMain.handle("hermes:stopGateway", async () => {
  if (!cliInitialized) return { success: false, error: "CLI 未初始化" };
  return cliService.stopGateway();
});
electron.ipcMain.handle("hermes:getConfig", async () => {
  if (!cliInitialized) return {};
  return cliService.getConfig();
});
electron.ipcMain.handle("hermes:setConfig", async (_, key, value) => {
  if (!cliInitialized) return { success: false, error: "CLI 未初始化" };
  return cliService.setConfig(key, value);
});
electron.ipcMain.handle("hermes:setupPlatform", async (_, platform, config) => {
  if (!cliInitialized) return { success: false, error: "CLI 未初始化" };
  return cliService.setupPlatform(platform, config);
});
electron.ipcMain.handle("hermes:getPlatforms", async () => {
  if (!cliInitialized) {
    return [
      { id: "telegram", name: "Telegram", enabled: false, state: "unknown" },
      { id: "discord", name: "Discord", enabled: false, state: "unknown" },
      { id: "slack", name: "Slack", enabled: false, state: "unknown" },
      { id: "feishu", name: "飞书", enabled: false, state: "unknown" },
      { id: "dingtalk", name: "钉钉", enabled: false, state: "unknown" }
    ];
  }
  return cliService.getPlatforms();
});
electron.app.whenReady().then(() => {
  createWindow();
  createTray();
  cliService.initialize().then((result) => {
    cliInitialized = result.success;
    if (!result.success) {
      console.log("CLI 初始化失败:", result.error);
    }
  });
});
electron.app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
  isQuitting = true;
});
electron.app.on("second-instance", () => {
  showMainWindow();
});
electron.app.on("activate", () => {
  showMainWindow();
});
//# sourceMappingURL=index.js.map
