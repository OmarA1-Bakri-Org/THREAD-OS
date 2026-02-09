'use client'
import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { StepNode } from './StepNode'
import { GateNode } from './GateNode'
import { useUIStore } from '@/lib/ui/store'
import { useSequence } from '@/lib/ui/api'

const nodeTypes = {
  stepNode: StepNode,
  gateNode: GateNode,
}

interface SequenceStep {
  id: string
  name: string
  type: string
  status: string
  model?: string
  depends_on?: string[]
  cwd?: string
  [key: string]: unknown
}

interface SequenceData {
  steps?: SequenceStep[]
  gates?: Array<{ id: string; name: string; status: string; after?: string; before?: string }>
}

// Layout constants for left-to-right horizontal flow
const NODE_WIDTH = 220
const NODE_HEIGHT = 80
const GATE_SIZE = 100
const H_GAP = 80
const V_GAP = 40

function buildLayout(data: SequenceData | undefined): { nodes: Node[]; edges: Edge[] } {
  if (!data) return { nodes: [], edges: [] }

  const steps = data.steps || []
  const gates = data.gates || []

  // Build dependency graph to compute columns (topological layers)
  const depMap = new Map<string, string[]>()
  const allIds = new Set<string>()

  for (const step of steps) {
    allIds.add(step.id)
    depMap.set(step.id, step.depends_on || [])
  }

  for (const gate of gates) {
    allIds.add(gate.id)
    const deps: string[] = []
    if (gate.after) deps.push(gate.after)
    depMap.set(gate.id, deps)
  }

  // Assign columns via topological ordering
  const columnOf = new Map<string, number>()
  const visited = new Set<string>()

  function getColumn(id: string): number {
    if (columnOf.has(id)) return columnOf.get(id)!
    if (visited.has(id)) return 0 // cycle guard
    visited.add(id)
    const deps = depMap.get(id) || []
    const maxDep = deps.length > 0 ? Math.max(...deps.map(d => getColumn(d))) + 1 : 0
    columnOf.set(id, maxDep)
    return maxDep
  }

  for (const id of allIds) getColumn(id)

  // Group items by column
  const columns = new Map<number, string[]>()
  for (const [id, col] of columnOf) {
    if (!columns.has(col)) columns.set(col, [])
    columns.get(col)!.push(id)
  }

  const nodes: Node[] = []
  const edges: Edge[] = []

  // Position nodes
  const stepMap = new Map(steps.map(s => [s.id, s]))
  const gateMap = new Map(gates.map(g => [g.id, g]))

  const sortedCols = [...columns.keys()].sort((a, b) => a - b)
  for (const col of sortedCols) {
    const items = columns.get(col)!
    const totalHeight = items.length * (NODE_HEIGHT + V_GAP) - V_GAP
    const startY = -totalHeight / 2

    items.forEach((id, rowIndex) => {
      const x = col * (NODE_WIDTH + H_GAP)
      const y = startY + rowIndex * (NODE_HEIGHT + V_GAP)

      const step = stepMap.get(id)
      const gate = gateMap.get(id)

      if (step) {
        nodes.push({
          id: step.id,
          type: 'stepNode',
          position: { x, y },
          data: {
            label: step.name,
            type: step.type || 'code',
            status: step.status || 'READY',
            model: step.model,
          },
        })
        // Edges from dependencies
        for (const dep of step.depends_on || []) {
          edges.push({
            id: `e-${dep}-${step.id}`,
            source: dep,
            target: step.id,
            animated: step.status === 'RUNNING',
            style: { stroke: 'var(--color-muted-foreground)', strokeWidth: 1.5 },
          })
        }
      } else if (gate) {
        nodes.push({
          id: gate.id,
          type: 'gateNode',
          position: { x: x + (NODE_WIDTH - GATE_SIZE) / 2, y: y - 10 },
          data: {
            label: gate.name,
            status: gate.status || 'PENDING',
            gateId: gate.id,
          },
        })
        if (gate.after) {
          edges.push({
            id: `e-${gate.after}-${gate.id}`,
            source: gate.after,
            target: gate.id,
            style: { stroke: 'var(--color-muted-foreground)', strokeWidth: 1.5, strokeDasharray: '5 3' },
          })
        }
        if (gate.before) {
          edges.push({
            id: `e-${gate.id}-${gate.before}`,
            source: gate.id,
            target: gate.before,
            style: { stroke: 'var(--color-muted-foreground)', strokeWidth: 1.5, strokeDasharray: '5 3' },
          })
        }
      }
    })
  }

  return { nodes, edges }
}

// Fallback demo data when API has no data
const DEMO_DATA: SequenceData = {
  steps: [
    { id: 'plan', name: 'Plan Implementation', type: 'prompt', status: 'DONE', model: 'claude-opus-4' },
    { id: 'scaffold', name: 'Scaffold Code', type: 'code', status: 'DONE', model: 'claude-sonnet-4', depends_on: ['plan'] },
    { id: 'implement', name: 'Implement Features', type: 'code', status: 'RUNNING', model: 'claude-opus-4', depends_on: ['scaffold'] },
    { id: 'test', name: 'Run Tests', type: 'test', status: 'READY', depends_on: ['implement'] },
    { id: 'review', name: 'Code Review', type: 'review', status: 'BLOCKED', model: 'claude-opus-4', depends_on: ['test'] },
    { id: 'deploy', name: 'Deploy to Staging', type: 'deploy', status: 'BLOCKED', depends_on: ['review'] },
  ],
  gates: [
    { id: 'gate-review', name: 'Review Gate', status: 'PENDING', after: 'test', before: 'review' },
  ],
}

export function SequenceCanvas() {
  const { data: sequenceData, isLoading } = useSequence()
  const minimapVisible = useUIStore((s) => s.minimapVisible)
  const setSelectedNode = useUIStore((s) => s.setSelectedNode)

  // Use real data if available, otherwise demo data
  const sourceData = sequenceData?.steps ? sequenceData : DEMO_DATA
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => buildLayout(sourceData), [sourceData])

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)

  // Sync layout when data changes
  useEffect(() => {
    setNodes(layoutNodes)
    setEdges(layoutEdges)
  }, [layoutNodes, layoutEdges, setNodes, setEdges])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node.id)
  }, [setSelectedNode])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading sequence...
          </div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
        <Controls className="!bg-card !border-border !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent" />
        {minimapVisible && (
          <MiniMap
            className="!bg-card !border-border"
            nodeColor={(node) => {
              const status = (node.data as Record<string, unknown>)?.status as string
              switch (status) {
                case 'RUNNING': return '#f59e0b'
                case 'DONE': return '#22c55e'
                case 'FAILED': return '#ef4444'
                case 'BLOCKED': return '#9ca3af'
                case 'NEEDS_REVIEW': return '#a855f7'
                default: return '#3b82f6'
              }
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
        )}
      </ReactFlow>
    </div>
  )
}
