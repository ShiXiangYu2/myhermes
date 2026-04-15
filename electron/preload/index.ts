import { contextBridge, ipcRenderer } from 'electron'

// Hermes API 接口定义
export interface HermesAPI {
  // 安装检查
  checkInstall(): Promise<{ success: boolean; error?: string }>

  // 状态
  getStatus(): Promise<{
    version: string
    gatewayRunning: boolean
    gatewayPid: number | null
    activeSessions: number
    configPath: string
    hermesHome: string
    error?: string
  }>

  // 网关控制
  startGateway(): Promise<{ success: boolean; error?: string }>
  stopGateway(): Promise<{ success: boolean; error?: string }>

  // 配置管理
  getConfig(): Promise<Record<string, unknown>>
  setConfig(key: string, value: unknown): Promise<{ success: boolean; error?: string }>

  // 平台管理
  getPlatforms(): Promise<Array<{
    id: string
    name: string
    enabled: boolean
    state: 'connected' | 'disconnected' | 'error' | 'unknown'
    errorMessage?: string
  }>>
  setupPlatform(platform: string, config: Record<string, string>): Promise<{ success: boolean; error?: string }>

  // 导航事件监听
  onNavigate(callback: (page: string) => void): () => void
}

// Hermes API 实现
const hermesAPI: HermesAPI = {
  checkInstall: () => ipcRenderer.invoke('hermes:checkInstall'),
  getStatus: () => ipcRenderer.invoke('hermes:getStatus'),
  startGateway: () => ipcRenderer.invoke('hermes:startGateway'),
  stopGateway: () => ipcRenderer.invoke('hermes:stopGateway'),
  getConfig: () => ipcRenderer.invoke('hermes:getConfig'),
  setConfig: (key, value) => ipcRenderer.invoke('hermes:setConfig', key, value),
  getPlatforms: () => ipcRenderer.invoke('hermes:getPlatforms'),
  setupPlatform: (platform, config) => ipcRenderer.invoke('hermes:setupPlatform', platform, config),
  onNavigate: (callback) => {
    const handler = (_: unknown, page: string) => callback(page)
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.off('navigate', handler)
  },
}

// 暴露到 window 对象
contextBridge.exposeInMainWorld('hermes', hermesAPI)

// TypeScript 类型声明
declare global {
  interface Window {
    hermes: HermesAPI
  }
}
