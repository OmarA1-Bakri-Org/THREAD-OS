#!/usr/bin/env bun
import { parseArgs } from 'util'
import { ZodError } from 'zod'
import { initCommand } from './commands/init'
import { runCommand } from './commands/run'
import { statusCommand } from './commands/status'
import { stepCommand } from './commands/step'
import { depCommand } from './commands/dep'
import { gateCommand } from './commands/gate'
import { groupCommand } from './commands/group'
import { fusionCommand } from './commands/fusion'
import { controlCommand } from './commands/control'
import { mprocsCmdCommand } from './commands/mprocs-cmd'

// Explicit CLI options interface
interface CLIOptions {
  json: boolean
  help: boolean
  watch: boolean
}

// Command handler type
type CommandHandler = (
  subcommand: string | undefined,
  args: string[],
  options: CLIOptions
) => Promise<void>

const commands: Record<string, CommandHandler> = {
  init: initCommand,
  step: stepCommand,
  dep: depCommand,
  gate: gateCommand,
  group: groupCommand,
  fusion: fusionCommand,
  run: runCommand,
  stop: (sub, args, opts) => controlCommand('stop', sub ? [sub, ...args] : args, opts),
  restart: (sub, args, opts) => controlCommand('restart', sub ? [sub, ...args] : args, opts),
  status: statusCommand,
  mprocs: mprocsCmdCommand,
}

// Error formatting utility
function formatError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      json: { type: 'boolean', short: 'j', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      watch: { type: 'boolean', short: 'w', default: false },
    },
    allowPositionals: true,
  })

  const options: CLIOptions = {
    json: values.json ?? false,
    help: values.help ?? false,
    watch: values.watch ?? false,
  }

  const [command, subcommand, ...args] = positionals

  if (options.help || !command) {
    console.log(`
seqctl - ThreadOS Sequence Controller

Usage:
  seqctl <command> [subcommand] [options]

Commands:
  init                            Initialize .threados/ directory
  step add|edit|rm|clone          Manage steps
  dep add|rm                      Manage dependencies
  gate insert|approve|block|list  Manage approval gates
  group parallelize|list          Manage parallel groups
  fusion create                   Create fusion structures
  run step|runnable|group         Execute steps
  stop <stepId>                   Stop a running step
  restart <stepId>                Restart a step
  status [--watch]                Show sequence status
  mprocs open|select              Manage mprocs session

Options:
  -j, --json              Output as JSON
  -h, --help              Show help
  -w, --watch             Watch for changes (status only)
`)
    process.exit(0)
  }

  const handler = commands[command]
  if (!handler) {
    const errorMsg = `Unknown command: ${command}`
    if (options.json) {
      console.log(JSON.stringify({ error: errorMsg, success: false }))
    } else {
      console.error(errorMsg)
    }
    process.exit(1)
  }

  try {
    await handler(subcommand, args, options)
  } catch (error) {
    const message = formatError(error)
    if (options.json) {
      console.log(JSON.stringify({ error: message, success: false }))
    } else {
      console.error(`Error: ${message}`)
    }
    process.exit(1)
  }
}

main()
