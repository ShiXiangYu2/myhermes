import { app, BrowserWindow, Menu, Tray, nativeImage, screen, shell, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { cliService } from './cli-service'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_DIST = path.join(__dirname, '../..')
const RENDERER_DIST = path.join(MAIN_DIST, 'hermes_cli/web_dist')

const IS_DEV = process.env.VITE_DEV_SERVER_URL || !app.isPackaged
process.env.VITE_PUBLIC = IS_DEV
  ? path.join(MAIN_DIST, '../web/public')
  : RENDERER_DIST

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let cliInitialized = false

const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

function resolveAppIcon(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.VITE_PUBLIC!, 'favicon.ico')
  }
  return path.join(process.env.VITE_PUBLIC!, 'icon.png')
}

function loadRuntimeAppIcon() {
  const iconPath = resolveAppIcon()
  if (!existsSync(iconPath)) return null
  const icon = nativeImage.createFromPath(iconPath)
  return icon.isEmpty() ? null : icon
}

function createWindow() {
  const workAreaSize = screen.getPrimaryDisplay().workAreaSize

  const browserWindow = new BrowserWindow({
    title: 'Hermes Desktop',
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win = browserWindow

  if (process.platform === 'darwin') {
    const dockIcon = loadRuntimeAppIcon()
    if (dockIcon) {
      app.dock.setIcon(dockIcon)
    }
  }

  browserWindow.once('ready-to-show', () => {
    browserWindow.show()
    if (IS_DEV) {
      browserWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  browserWindow.on('closed', () => {
    win = null
  })

  browserWindow.on('close', (event) => {
    if (process.platform !== 'darwin' || isQuitting) return
    event.preventDefault()
    browserWindow.hide()
  })

  if (IS_DEV && process.env.VITE_DEV_SERVER_URL) {
    browserWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    browserWindow.loadFile(indexHtml)
  }

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  return browserWindow
}

function showMainWindow() {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  } else {
    createWindow()
  }
}

function createTray() {
  const iconPath = path.join(process.env.VITE_PUBLIC!, 'tray.png')
  let trayIcon: Electron.NativeImage

  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty()
    }
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

  if (process.platform === 'darwin') {
    trayIcon.setTemplateImage(true)
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Hermes Desktop')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: showMainWindow,
    },
    { type: 'separator' },
    {
      label: '配置模型',
      click: () => {
        showMainWindow()
        win?.webContents.send('navigate', 'config')
      },
    },
    {
      label: '网关状态',
      click: () => {
        showMainWindow()
        win?.webContents.send('navigate', 'status')
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', showMainWindow)
}

// ============ IPC 处理 ============

// 初始化检查
ipcMain.handle('hermes:checkInstall', async () => {
  const result = await cliService.initialize()
  cliInitialized = result.success
  return result
})

// 获取 Hermes 状态
ipcMain.handle('hermes:getStatus', async () => {
  if (!cliInitialized) {
    const init = await cliService.initialize()
    if (!init.success) return { error: init.error }
    cliInitialized = true
  }
  return cliService.getStatus()
})

// 启动网关
ipcMain.handle('hermes:startGateway', async () => {
  if (!cliInitialized) return { success: false, error: 'CLI 未初始化' }
  return cliService.startGateway()
})

// 停止网关
ipcMain.handle('hermes:stopGateway', async () => {
  if (!cliInitialized) return { success: false, error: 'CLI 未初始化' }
  return cliService.stopGateway()
})

// 获取配置
ipcMain.handle('hermes:getConfig', async () => {
  if (!cliInitialized) return {}
  return cliService.getConfig()
})

// 保存配置
ipcMain.handle('hermes:setConfig', async (_, key: string, value: unknown) => {
  if (!cliInitialized) return { success: false, error: 'CLI 未初始化' }
  return cliService.setConfig(key, value)
})

// 平台设置
ipcMain.handle('hermes:setupPlatform', async (_, platform: string, config: Record<string, string>) => {
  if (!cliInitialized) return { success: false, error: 'CLI 未初始化' }
  return cliService.setupPlatform(platform, config)
})

// 获取平台列表
ipcMain.handle('hermes:getPlatforms', async () => {
  if (!cliInitialized) {
    return [
      { id: 'telegram', name: 'Telegram', enabled: false, state: 'unknown' },
      { id: 'discord', name: 'Discord', enabled: false, state: 'unknown' },
      { id: 'slack', name: 'Slack', enabled: false, state: 'unknown' },
      { id: 'feishu', name: '飞书', enabled: false, state: 'unknown' },
      { id: 'dingtalk', name: '钉钉', enabled: false, state: 'unknown' },
    ]
  }
  return cliService.getPlatforms()
})

// 应用生命周期
app.whenReady().then(() => {
  createWindow()
  createTray()

  // 自动初始化 CLI
  cliService.initialize().then(result => {
    cliInitialized = result.success
    if (!result.success) {
      console.log('CLI 初始化失败:', result.error)
    }
  })
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('second-instance', () => {
  showMainWindow()
})

app.on('activate', () => {
  showMainWindow()
})
