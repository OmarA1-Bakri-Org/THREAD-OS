import { parseArgs } from 'util'
import { readSequence, writeSequence } from '../../sequence/parser'
import { validateDAG } from '../../sequence/dag'
import { StepNotFoundError } from '../../errors'
import { StepSchema, type Step } from '../../sequence/schema'
import { writePrompt } from '../../prompts/manager'

interface CLIOptions {
  json: boolean
  help: boolean
  watch: boolean
}

interface FusionResult {
  success: boolean
  action: string
  synthId?: string
  candidates?: string[]
  message?: string
  error?: string
}

/**
 * Parse fusion subcommand options
 */
function parseFusionArgs(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      candidates: { type: 'string' },
      synth: { type: 'string' },
      name: { type: 'string', short: 'n' },
      model: { type: 'string', short: 'm' },
    },
    allowPositionals: true,
    strict: false,
  })

  return { values, positionals }
}

/**
 * Create a fusion structure
 */
async function createFusion(
  basePath: string,
  options: Record<string, unknown>
): Promise<FusionResult> {
  const candidatesRaw = options.candidates as string | undefined
  const synthId = options.synth as string | undefined

  if (!candidatesRaw) {
    return {
      success: false,
      action: 'create',
      error: 'Missing required option: --candidates <stepId1,stepId2,...>',
    }
  }

  if (!synthId) {
    return {
      success: false,
      action: 'create',
      error: 'Missing required option: --synth <synthStepId>',
    }
  }

  const candidateIds = candidatesRaw.split(',').map(s => s.trim())

  if (candidateIds.length < 2) {
    return {
      success: false,
      action: 'create',
      error: 'Fusion requires at least 2 candidate steps',
    }
  }

  const sequence = await readSequence(basePath)

  // Validate all candidate step IDs exist
  for (const candidateId of candidateIds) {
    if (!sequence.steps.some(s => s.id === candidateId)) {
      return {
        success: false,
        action: 'create',
        error: new StepNotFoundError(candidateId).message,
      }
    }
  }

  // Check if synth step already exists
  if (sequence.steps.some(s => s.id === synthId)) {
    return {
      success: false,
      action: 'create',
      synthId,
      candidates: candidateIds,
      error: `Step '${synthId}' already exists`,
    }
  }

  // Mark each candidate step with fusion_candidates containing all other candidate IDs
  for (const candidateId of candidateIds) {
    const step = sequence.steps.find(s => s.id === candidateId)!
    step.fusion_candidates = candidateIds.filter(id => id !== candidateId)
  }

  // Build the synth step
  const synthName = (options.name as string) || `<${synthId}>`
  const synthStep: Step = {
    id: synthId,
    name: synthName,
    type: 'f',
    model: (options.model as string as Step['model']) || 'claude-code',
    prompt_file: `.threados/prompts/${synthId}.md`,
    depends_on: [...candidateIds],
    fusion_synth: true,
    fusion_candidates: [...candidateIds],
    status: 'READY',
  }

  // Validate the synth step
  const validation = StepSchema.safeParse(synthStep)
  if (!validation.success) {
    return {
      success: false,
      action: 'create',
      synthId,
      candidates: candidateIds,
      error: validation.error.issues.map(e => e.message).join(', '),
    }
  }

  sequence.steps.push(validation.data)

  // Validate DAG
  try {
    validateDAG(sequence)
  } catch (error) {
    return {
      success: false,
      action: 'create',
      synthId,
      candidates: candidateIds,
      error: error instanceof Error ? error.message : 'DAG validation failed',
    }
  }

  await writeSequence(basePath, sequence)

  // Create prompt file for synth step
  await writePrompt(basePath, synthId, `# ${synthName}\n\n<!-- Add your prompt here -->\n`)

  return {
    success: true,
    action: 'create',
    synthId,
    candidates: candidateIds,
    message: `Fusion created: candidates [${candidateIds.join(', ')}] -> synth '${synthId}'`,
  }
}

/**
 * Fusion command handler
 */
export async function fusionCommand(
  subcommand: string | undefined,
  args: string[],
  options: CLIOptions
): Promise<void> {
  const basePath = process.cwd()
  const { values } = parseFusionArgs(args)

  let result: FusionResult

  switch (subcommand) {
    case 'create': {
      result = await createFusion(basePath, values)
      break
    }

    default: {
      result = {
        success: false,
        action: subcommand || 'unknown',
        error: 'Unknown subcommand. Usage: seqctl fusion create',
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
