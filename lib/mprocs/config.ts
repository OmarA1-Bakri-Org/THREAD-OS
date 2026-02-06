import YAML from 'yaml'
import type { Sequence, Step } from '../sequence/schema'

interface MprocsProcessConfig {
  name: string
  cmd: string[]
  cwd?: string
  autostart?: boolean
}

interface MprocsConfig {
  server?: {
    host: string
    port: number
  }
  procs: Record<string, MprocsProcessConfig>
}

const DEFAULT_SERVER_HOST = '127.0.0.1'
const DEFAULT_SERVER_PORT = 4050

/**
 * Generate a command array for a step based on its model type
 */
function generateStepCommand(step: Step): string[] {
  // Base command depends on model type
  switch (step.model) {
    case 'claude-code':
      return ['claude', '--prompt-file', step.prompt_file]
    case 'codex':
      return ['codex', '--prompt-file', step.prompt_file]
    case 'gemini':
      return ['gemini', '--prompt-file', step.prompt_file]
    default:
      // Fallback for unknown models
      return ['echo', `Running step: ${step.id}`]
  }
}

/**
 * Generate mprocs.yaml configuration from a sequence
 *
 * @param sequence - The sequence to generate configuration for
 * @param options - Optional configuration options
 * @returns The mprocs configuration as a YAML string
 */
export function generateMprocsConfig(
  sequence: Sequence,
  options?: {
    serverHost?: string
    serverPort?: number
    autostart?: boolean
  }
): string {
  const serverHost = options?.serverHost ?? DEFAULT_SERVER_HOST
  const serverPort = options?.serverPort ?? DEFAULT_SERVER_PORT
  const autostart = options?.autostart ?? false

  const procs: Record<string, MprocsProcessConfig> = {}

  for (const step of sequence.steps) {
    procs[step.id] = {
      name: step.name,
      cmd: generateStepCommand(step),
      ...(step.cwd && { cwd: step.cwd }),
      autostart,
    }
  }

  const config: MprocsConfig = {
    server: {
      host: serverHost,
      port: serverPort,
    },
    procs,
  }

  return YAML.stringify(config, { indent: 2 })
}

/**
 * Generate mprocs configuration object (not YAML string)
 *
 * @param sequence - The sequence to generate configuration for
 * @param options - Optional configuration options
 * @returns The mprocs configuration object
 */
export function generateMprocsConfigObject(
  sequence: Sequence,
  options?: {
    serverHost?: string
    serverPort?: number
    autostart?: boolean
  }
): MprocsConfig {
  const serverHost = options?.serverHost ?? DEFAULT_SERVER_HOST
  const serverPort = options?.serverPort ?? DEFAULT_SERVER_PORT
  const autostart = options?.autostart ?? false

  const procs: Record<string, MprocsProcessConfig> = {}

  for (const step of sequence.steps) {
    procs[step.id] = {
      name: step.name,
      cmd: generateStepCommand(step),
      ...(step.cwd && { cwd: step.cwd }),
      autostart,
    }
  }

  return {
    server: {
      host: serverHost,
      port: serverPort,
    },
    procs,
  }
}
