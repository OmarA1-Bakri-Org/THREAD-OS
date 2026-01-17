import { $ } from 'bun'
import { join } from 'path'
import YAML from 'yaml'
import { MprocsConnectionError } from '../errors'

// Discriminated union for type-safe mprocs commands
export type MprocsCommand =
  | { c: 'quit' }
  | { c: 'start-proc' }
  | { c: 'term-proc' }
  | { c: 'kill-proc' }
  | { c: 'restart-proc' }
  | { c: 'select-proc'; index: number }
  | { c: 'send-key'; key: string }
  | { c: 'add-proc'; name: string; cmd: string[] }
  | { c: 'remove-proc'; id: string }
  | { c: 'batch'; ops: MprocsCommand[] }

// Result type for command execution
export interface MprocsResult {
  success: boolean
  exitCode: number
  stderr?: string
}

export class MprocsClient {
  private serverAddress: string
  private mprocsPath: string

  constructor(
    serverAddress = '127.0.0.1:4050',
    mprocsPath = process.env.THREADOS_MPROCS_PATH ||
      join(process.cwd(), 'vendor/mprocs/windows/mprocs.exe')
  ) {
    this.serverAddress = serverAddress
    this.mprocsPath = mprocsPath
  }

  /**
   * Send a command to the mprocs server
   */
  async sendCommand(command: MprocsCommand): Promise<MprocsResult> {
    // Use proper YAML library for serialization
    const payload =
      command.c === 'batch' && 'ops' in command
        ? { ...command, cmds: command.ops }
        : command

    const yaml = YAML.stringify(payload).trim()

    try {
      const result = await $`${this.mprocsPath} --ctl ${yaml} --server ${this.serverAddress}`.quiet()
      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
      }
    } catch (error: unknown) {
      // Bun's $ throws on non-zero exit by default
      if (error && typeof error === 'object' && 'exitCode' in error) {
        const shellError = error as { exitCode: number; stderr?: Buffer }
        return {
          success: false,
          exitCode: shellError.exitCode,
          stderr: shellError.stderr?.toString(),
        }
      }
      throw error // Re-throw unexpected errors
    }
  }

  /**
   * Start a process, optionally selecting it first by index
   */
  async startProcess(index?: number): Promise<MprocsResult> {
    if (index !== undefined) {
      return this.sendCommand({
        c: 'batch',
        ops: [
          { c: 'select-proc', index },
          { c: 'start-proc' },
        ],
      })
    }
    return this.sendCommand({ c: 'start-proc' })
  }

  /**
   * Stop/terminate a process, optionally selecting it first by index
   */
  async stopProcess(index?: number): Promise<MprocsResult> {
    if (index !== undefined) {
      return this.sendCommand({
        c: 'batch',
        ops: [
          { c: 'select-proc', index },
          { c: 'term-proc' },
        ],
      })
    }
    return this.sendCommand({ c: 'term-proc' })
  }

  /**
   * Restart a process, optionally selecting it first by index
   */
  async restartProcess(index?: number): Promise<MprocsResult> {
    if (index !== undefined) {
      return this.sendCommand({
        c: 'batch',
        ops: [
          { c: 'select-proc', index },
          { c: 'restart-proc' },
        ],
      })
    }
    return this.sendCommand({ c: 'restart-proc' })
  }

  /**
   * Add a new process dynamically
   */
  async addProcess(name: string, cmd: string[]): Promise<MprocsResult> {
    return this.sendCommand({ c: 'add-proc', name, cmd })
  }

  /**
   * Send multiple commands in a batch
   */
  async batch(commands: MprocsCommand[]): Promise<MprocsResult> {
    return this.sendCommand({ c: 'batch', ops: commands })
  }

  /**
   * Health check - verify mprocs server is running
   */
  async isServerRunning(): Promise<boolean> {
    try {
      const result = await this.sendCommand({ c: 'select-proc', index: 0 })
      return result.success
    } catch {
      return false
    }
  }

  /**
   * Wait for server to become available
   */
  async waitForServer(timeoutMs = 5000): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (await this.isServerRunning()) {
        return true
      }
      await Bun.sleep(100)
    }
    throw new MprocsConnectionError(this.serverAddress)
  }
}
