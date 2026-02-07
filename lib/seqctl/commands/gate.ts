import { parseArgs } from 'util'
import { readSequence, writeSequence } from '../../sequence/parser'
import { validateDAG } from '../../sequence/dag'
import { GateNotFoundError } from '../../errors'
import { GateSchema, type Gate, type GateStatus } from '../../sequence/schema'

interface CLIOptions {
  json: boolean
  help: boolean
  watch: boolean
}

interface GateResult {
  success: boolean
  action: string
  gateId: string
  message?: string
  error?: string
  gates?: Array<{ id: string; name: string; status: string; depends_on: string[] }>
}

/**
 * Parse gate subcommand options
 */
function parseGateArgs(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      name: { type: 'string', short: 'n' },
      'depends-on': { type: 'string', short: 'd' },
    },
    allowPositionals: true,
    strict: false,
  })

  return { values, positionals }
}

/**
 * Insert a new gate
 */
async function insertGate(
  basePath: string,
  gateId: string,
  options: Record<string, unknown>
): Promise<GateResult> {
  const sequence = await readSequence(basePath)

  // Check if gate ID already exists across both steps and gates
  if (sequence.gates.some(g => g.id === gateId)) {
    return {
      success: false,
      action: 'insert',
      gateId,
      error: `Gate '${gateId}' already exists`,
    }
  }

  if (sequence.steps.some(s => s.id === gateId)) {
    return {
      success: false,
      action: 'insert',
      gateId,
      error: `ID '${gateId}' already exists as a step`,
    }
  }

  // Build gate object
  const newGate: Gate = {
    id: gateId,
    name: (options.name as string) || gateId,
    depends_on: options['depends-on']
      ? (options['depends-on'] as string).split(',').map(s => s.trim())
      : [],
    status: 'PENDING' as GateStatus,
  }

  // Validate the gate
  const validation = GateSchema.safeParse(newGate)
  if (!validation.success) {
    return {
      success: false,
      action: 'insert',
      gateId,
      error: validation.error.issues.map(e => e.message).join(', '),
    }
  }

  sequence.gates.push(validation.data)

  // Validate DAG
  try {
    validateDAG(sequence)
  } catch (error) {
    return {
      success: false,
      action: 'insert',
      gateId,
      error: error instanceof Error ? error.message : 'DAG validation failed',
    }
  }

  await writeSequence(basePath, sequence)

  return {
    success: true,
    action: 'insert',
    gateId,
    message: `Gate '${gateId}' inserted successfully`,
  }
}

/**
 * Approve a gate and unblock dependent steps whose dependencies are all satisfied
 */
async function approveGate(
  basePath: string,
  gateId: string
): Promise<GateResult> {
  const sequence = await readSequence(basePath)

  const gateIndex = sequence.gates.findIndex(g => g.id === gateId)
  if (gateIndex === -1) {
    return {
      success: false,
      action: 'approve',
      gateId,
      error: new GateNotFoundError(gateId).message,
    }
  }

  sequence.gates[gateIndex].status = 'APPROVED'

  // For each step that depends on this gate, check if all dependencies are satisfied
  for (const step of sequence.steps) {
    if (step.status !== 'BLOCKED') continue
    if (!step.depends_on.includes(gateId)) continue

    const allSatisfied = step.depends_on.every(depId => {
      const depStep = sequence.steps.find(s => s.id === depId)
      if (depStep) return depStep.status === 'DONE'

      const depGate = sequence.gates.find(g => g.id === depId)
      if (depGate) return depGate.status === 'APPROVED'

      return false
    })

    if (allSatisfied) {
      step.status = 'READY'
    }
  }

  await writeSequence(basePath, sequence)

  return {
    success: true,
    action: 'approve',
    gateId,
    message: `Gate '${gateId}' approved`,
  }
}

/**
 * Block a gate
 */
async function blockGate(
  basePath: string,
  gateId: string
): Promise<GateResult> {
  const sequence = await readSequence(basePath)

  const gateIndex = sequence.gates.findIndex(g => g.id === gateId)
  if (gateIndex === -1) {
    return {
      success: false,
      action: 'block',
      gateId,
      error: new GateNotFoundError(gateId).message,
    }
  }

  sequence.gates[gateIndex].status = 'BLOCKED'

  await writeSequence(basePath, sequence)

  return {
    success: true,
    action: 'block',
    gateId,
    message: `Gate '${gateId}' blocked`,
  }
}

/**
 * List all gates
 */
async function listGates(
  basePath: string
): Promise<GateResult> {
  const sequence = await readSequence(basePath)

  const gates = sequence.gates.map(g => ({
    id: g.id,
    name: g.name,
    status: g.status,
    depends_on: g.depends_on,
  }))

  return {
    success: true,
    action: 'list',
    gateId: '',
    gates,
  }
}

/**
 * Gate command handler
 */
export async function gateCommand(
  subcommand: string | undefined,
  args: string[],
  options: CLIOptions
): Promise<void> {
  const basePath = process.cwd()
  const { values, positionals } = parseGateArgs(args)

  let result: GateResult

  switch (subcommand) {
    case 'insert': {
      const gateId = positionals[0]
      if (!gateId) {
        result = {
          success: false,
          action: 'insert',
          gateId: '',
          error: 'Gate ID required: seqctl gate insert <gateId> [options]',
        }
      } else {
        result = await insertGate(basePath, gateId, values)
      }
      break
    }

    case 'approve': {
      const gateId = positionals[0]
      if (!gateId) {
        result = {
          success: false,
          action: 'approve',
          gateId: '',
          error: 'Gate ID required: seqctl gate approve <gateId>',
        }
      } else {
        result = await approveGate(basePath, gateId)
      }
      break
    }

    case 'block': {
      const gateId = positionals[0]
      if (!gateId) {
        result = {
          success: false,
          action: 'block',
          gateId: '',
          error: 'Gate ID required: seqctl gate block <gateId>',
        }
      } else {
        result = await blockGate(basePath, gateId)
      }
      break
    }

    case 'list': {
      result = await listGates(basePath)
      break
    }

    default: {
      result = {
        success: false,
        action: subcommand || 'unknown',
        gateId: '',
        error: 'Unknown subcommand. Usage: seqctl gate insert|approve|block|list',
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(result))
  } else {
    if (result.success) {
      if (result.action === 'list' && result.gates) {
        if (result.gates.length === 0) {
          console.log('No gates defined')
        } else {
          for (const gate of result.gates) {
            const deps = gate.depends_on.length > 0 ? ` (depends on: ${gate.depends_on.join(', ')})` : ''
            console.log(`${gate.id}\t${gate.status}\t${gate.name}${deps}`)
          }
        }
      } else {
        console.log(result.message)
      }
    } else {
      console.error(`Error: ${result.error}`)
      process.exit(1)
    }
  }
}
