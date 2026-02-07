import { spawn } from 'child_process'
import { join } from 'path'
import { readSequence } from '../../sequence/parser'
import { generateMprocsConfig } from '../../mprocs/config'
import { MprocsClient } from '../../mprocs/client'
import { readMprocsMap } from '../../mprocs/state'
import { StepNotFoundError } from '../../errors'
import { writeFileAtomic } from '../../fs/atomic'

interface CLIOptions {
  json: boolean
  help: boolean
  watch: boolean
}

interface MprocsCmdResult {
  success: boolean
  action: string
  message?: string
  error?: string
}

async function openMprocs(basePath: string): Promise<MprocsCmdResult> {
  const sequence = await readSequence(basePath)
  const configYaml = generateMprocsConfig(sequence)

  const configPath = join(basePath, '.threados/state/mprocs.yaml')
  await writeFileAtomic(configPath, configYaml)

  const mprocsPath = process.env.THREADOS_MPROCS_PATH ||
    join(basePath, 'vendor/mprocs/windows/mprocs.exe')

  const proc = spawn(mprocsPath, ['--config', configPath, '--server', '127.0.0.1:4050'], {
    detached: true,
    stdio: 'ignore',
  })
  proc.unref()

  const client = new MprocsClient()
  try {
    await client.waitForServer(10000)
  } catch {
    return {
      success: false,
      action: 'open',
      error: 'mprocs server did not become available within 10 seconds',
    }
  }

  return {
    success: true,
    action: 'open',
    message: `mprocs launched with ${sequence.steps.length} process(es)`,
  }
}

async function selectMprocs(basePath: string, stepId: string): Promise<MprocsCmdResult> {
  const mprocsMap = await readMprocsMap(basePath)
  const processIndex = mprocsMap[stepId]

  if (processIndex === undefined) {
    return {
      success: false,
      action: 'select',
      error: new StepNotFoundError(stepId).message,
    }
  }

  const client = new MprocsClient()
  const result = await client.sendCommand({ c: 'select-proc', index: processIndex })

  if (!result.success) {
    return {
      success: false,
      action: 'select',
      error: `Failed to select process for step '${stepId}'`,
    }
  }

  return {
    success: true,
    action: 'select',
    message: `Selected process ${processIndex} for step '${stepId}'`,
  }
}

export async function mprocsCmdCommand(
  subcommand: string | undefined,
  args: string[],
  options: CLIOptions
): Promise<void> {
  const basePath = process.cwd()

  let result: MprocsCmdResult

  switch (subcommand) {
    case 'open': {
      result = await openMprocs(basePath)
      break
    }

    case 'select': {
      const stepId = args[0]
      if (!stepId) {
        result = {
          success: false,
          action: 'select',
          error: 'Step ID required: seqctl mprocs select <stepId>',
        }
      } else {
        result = await selectMprocs(basePath, stepId)
      }
      break
    }

    default: {
      result = {
        success: false,
        action: subcommand || 'unknown',
        error: 'Unknown subcommand. Usage: seqctl mprocs open|select',
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(result))
  } else {
    if (result.success) {
      console.log(result.message)
    } else {
      console.error(`Error: ${result.error}`)
      process.exit(1)
    }
  }
}
