import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'

const execFileAsync = promisify(execFile)

// CLI 配置
interface CLIConfig {
  hermesHome: string
  configPath: string
  envPath: string
}

// Hermes 状态
export interface HermesStatus {
  version: string
  gatewayRunning: boolean
  gatewayPid: number | null
  activeSessions: number
  configPath: string
  hermesHome: string
}

// 平台信息
export interface PlatformInfo {
  id: string
  name: string
  enabled: boolean
  state: 'connected' | 'disconnected' | 'error' | 'unknown'
  errorMessage?: string
}

class CLIService {
  private hermesCommand: string | null = null
  private config: CLIConfig | null = null

  // 初始化：检测 hermes CLI
  async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      const hermesPath = await this.findHermesCommand()
      if (!hermesPath) {
        return {
          success: false,
          error: '未找到 hermes 命令。请先安装 Hermes Agent。'
        }
      }
      this.hermesCommand = hermesPath

      const hermesHome = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes')
      this.config = {
        hermesHome,
        configPath: path.join(hermesHome, 'config.yaml'),
        envPath: path.join(hermesHome, '.env')
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '初始化失败'
      }
    }
  }

  // 查找 hermes 命令
  private async findHermesCommand(): Promise<string | null> {
    const candidates = [
      'hermes',
      path.join(os.homedir(), '.local/bin/hermes'),
      path.join(os.homedir(), '.hermes/bin/hermes'),
    ]

    for (const cmd of candidates) {
      try {
        await execFileAsync(cmd, ['--version'])
        return cmd
      } catch {
        continue
      }
    }

    try {
      const { stdout } = await execFileAsync('which', ['hermes'])
      if (stdout.trim()) return stdout.trim()
    } catch {
      // ignore
    }

    return null
  }

  // 执行 hermes 命令
  private async runHermes(args: string[], options: { timeout?: number } = {}): Promise<{
    success: boolean
    stdout: string
    stderr: string
    error?: string
  }> {
    if (!this.hermesCommand) {
      return { success: false, stdout: '', stderr: '', error: 'Hermes CLI 未初始化' }
    }

    return new Promise((resolve) => {
      const child = spawn(this.hermesCommand!, args, {
        env: { ...process.env, ...this.getHermesEnv() }
      })

      let stdout = ''
      let stderr = ''
      let timeoutId: NodeJS.Timeout | null = null

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })
      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      if (options.timeout) {
        timeoutId = setTimeout(() => {
          child.kill()
          resolve({ success: false, stdout, stderr, error: '命令执行超时' })
        }, options.timeout)
      }

      child.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId)
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          error: code !== 0 ? stderr.trim() || `命令退出码: ${code}` : undefined
        })
      })

      child.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId)
        resolve({ success: false, stdout, stderr, error: err.message })
      })
    })
  }

  private getHermesEnv(): Record<string, string> {
    return {
      HERMES_HOME: this.config?.hermesHome || path.join(os.homedir(), '.hermes')
    }
  }

  // 获取状态
  async getStatus(): Promise<HermesStatus> {
    let version = 'unknown'
    try {
      const { stdout } = await this.runHermes(['--version'], { timeout: 5000 })
      const match = stdout.match(/hermes[\s/]+v?(\d+\.\d+\.?\d*)/i)
      version = match?.[1] || stdout.trim() || 'unknown'
    } catch {}

    const gatewayStatus = await this.checkGatewayStatus()

    return {
      version,
      gatewayRunning: gatewayStatus.running,
      gatewayPid: gatewayStatus.pid,
      activeSessions: gatewayStatus.sessions,
      configPath: this.config?.configPath || '',
      hermesHome: this.config?.hermesHome || ''
    }
  }

  private async checkGatewayStatus(): Promise<{ running: boolean; pid: number | null; sessions: number }> {
    try {
      if (this.config?.hermesHome) {
        const pidFile = path.join(this.config.hermesHome, 'gateway.pid')
        try {
          const pidStr = await fs.readFile(pidFile, 'utf-8')
          const pid = parseInt(pidStr.trim(), 10)
          if (!isNaN(pid)) {
            try {
              process.kill(pid, 0)
              return { running: true, pid, sessions: 0 }
            } catch {}
          }
        } catch {}
      }

      const { success, stdout } = await this.runHermes(['gateway', 'status'], { timeout: 5000 })
      if (success) {
        const running = stdout.includes('running') || stdout.includes('Running')
        const pidMatch = stdout.match(/PID[:\s]+(\d+)/i)
        return {
          running,
          pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
          sessions: 0
        }
      }
    } catch {}

    return { running: false, pid: null, sessions: 0 }
  }

  // 网关控制
  async startGateway(): Promise<{ success: boolean; error?: string }> {
    const { success, error } = await this.runHermes(['gateway', 'start', '--daemon'], { timeout: 10000 })
    if (!success) return { success: false, error: error || '启动网关失败' }

    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 500))
      const status = await this.checkGatewayStatus()
      if (status.running) return { success: true }
    }

    return { success: false, error: '网关启动超时' }
  }

  async stopGateway(): Promise<{ success: boolean; error?: string }> {
    const { success, error } = await this.runHermes(['gateway', 'stop'], { timeout: 10000 })
    if (!success) return { success: false, error: error || '停止网关失败' }
    return { success: true }
  }

  async restartGateway(): Promise<{ success: boolean; error?: string }> {
    await this.stopGateway()
    await new Promise(r => setTimeout(r, 1000))
    return this.startGateway()
  }

  // 配置管理
  async getConfig(): Promise<Record<string, unknown>> {
    try {
      if (!this.config?.configPath) return {}
      const content = await fs.readFile(this.config.configPath, 'utf-8')
      // 简单解析 YAML
      const result: Record<string, unknown> = {}
      for (const line of content.split('\n')) {
        const match = line.match(/^(\w+):\s*(.+)$/)
        if (match) {
          const [, key, value] = match
          result[key] = value.trim().replace(/^["']|["']$/g, '')
        }
      }
      return result
    } catch {
      return {}
    }
  }

  async setConfig(key: string, value: unknown): Promise<{ success: boolean; error?: string }> {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
    const { success, error } = await this.runHermes(['config', 'set', key, valueStr], { timeout: 5000 })
    if (!success) return { success: false, error: error || '设置配置失败' }
    return { success: true }
  }

  // 平台管理
  async getPlatforms(): Promise<PlatformInfo[]> {
    const platforms: PlatformInfo[] = [
      { id: 'telegram', name: 'Telegram', enabled: false, state: 'unknown' },
      { id: 'discord', name: 'Discord', enabled: false, state: 'unknown' },
      { id: 'slack', name: 'Slack', enabled: false, state: 'unknown' },
      { id: 'feishu', name: '飞书', enabled: false, state: 'unknown' },
      { id: 'dingtalk', name: '钉钉', enabled: false, state: 'unknown' },
      { id: 'matrix', name: 'Matrix', enabled: false, state: 'unknown' },
      { id: 'signal', name: 'Signal', enabled: false, state: 'unknown' },
      { id: 'whatsapp', name: 'WhatsApp', enabled: false, state: 'unknown' },
    ]

    const config = await this.getConfig()
    for (const platform of platforms) {
      const platformConfig = config[platform.id] as Record<string, unknown> | undefined
      const envEnabled = await this.checkEnvVar(`${platform.id.toUpperCase()}_TOKEN`)
      platform.enabled = !!(platformConfig as { enabled?: boolean })?.enabled || envEnabled
      platform.state = platform.enabled ? 'disconnected' : 'unknown'
    }

    return platforms
  }

  private async checkEnvVar(key: string): Promise<boolean> {
    try {
      if (!this.config?.envPath) return false
      const content = await fs.readFile(this.config.envPath, 'utf-8')
      return content.includes(`${key}=`)
    } catch {
      return false
    }
  }

  async setPlatformToken(platform: string, token: string): Promise<{ success: boolean; error?: string }> {
    const envKey = `${platform.toUpperCase()}_TOKEN`

    try {
      if (!this.config?.envPath) return { success: false, error: '环境变量路径未初始化' }

      let content = ''
      try {
        content = await fs.readFile(this.config.envPath, 'utf-8')
      } catch {}

      const lines = content.split('\n')
      const newLine = `${envKey}=${token}`
      let found = false

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(`${envKey}=`)) {
          lines[i] = newLine
          found = true
          break
        }
      }

      if (!found) lines.push(newLine)

      await fs.mkdir(path.dirname(this.config.envPath), { recursive: true })
      await fs.writeFile(this.config.envPath, lines.join('\n'), 'utf-8')

      await this.setConfig(`${platform}.enabled`, true)

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '设置平台 Token 失败' }
    }
  }

  async setupPlatform(platform: string, config: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    try {
      if (config.token) {
        const result = await this.setPlatformToken(platform, config.token)
        if (!result.success) return result
      }

      for (const [key, value] of Object.entries(config)) {
        if (key !== 'token') {
          await this.setConfig(`${platform}.${key}`, value)
        }
      }

      return this.restartGateway()
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '平台配置失败' }
    }
  }
}

export const cliService = new CLIService()
