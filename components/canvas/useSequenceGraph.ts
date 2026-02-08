'use client'

import { useMemo } from 'react'
import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'
import type { SequenceStatus } from '@/app/api/status/route'
import { STATUS_COLORS } from '@/lib/ui/constants'

const NODE_WIDTH = 200
const NODE_HEIGHT = 60
const GATE_SIZE = 80

export function useSequenceGraph(status: SequenceStatus | undefined, searchQuery: string) {
  return useMemo(() => {
    if (!status) return { nodes: [] as Node[], edges: [] as Edge[] }

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 })

    const lowerQuery = searchQuery.toLowerCase()

    for (const step of status.steps) {
      const hidden = lowerQuery && !step.id.toLowerCase().includes(lowerQuery) && !step.name.toLowerCase().includes(lowerQuery)
      if (!hidden) g.setNode(step.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }
    for (const gate of status.gates) {
      const hidden = lowerQuery && !gate.id.toLowerCase().includes(lowerQuery) && !gate.name.toLowerCase().includes(lowerQuery)
      if (!hidden) g.setNode(gate.id, { width: GATE_SIZE, height: GATE_SIZE })
    }

    // edges
    for (const step of status.steps) {
      for (const dep of step.dependsOn) {
        if (g.hasNode(step.id) && g.hasNode(dep)) g.setEdge(dep, step.id)
      }
    }
    for (const gate of status.gates) {
      for (const dep of gate.dependsOn) {
        if (g.hasNode(gate.id) && g.hasNode(dep)) g.setEdge(dep, gate.id)
      }
    }

    dagre.layout(g)

    const stepMap = new Map(status.steps.map(s => [s.id, s]))
    const gateMap = new Map(status.gates.map(g => [g.id, g]))

    const nodes: Node[] = g.nodes().map(id => {
      const pos = g.node(id)
      const step = stepMap.get(id)
      const gate = gateMap.get(id)
      if (step) {
        return {
          id, type: 'stepNode', position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
          data: { ...step, color: STATUS_COLORS[step.status] || '#94a3b8' },
        }
      }
      return {
        id, type: 'gateNode', position: { x: pos.x - GATE_SIZE / 2, y: pos.y - GATE_SIZE / 2 },
        data: { ...gate!, color: STATUS_COLORS[gate!.status] || '#94a3b8' },
      }
    })

    const edges: Edge[] = g.edges().map(e => {
      const target = stepMap.get(e.w) || gateMap.get(e.w)
      const sourceStatus = stepMap.get(e.v)?.status || gateMap.get(e.v)?.status || 'READY'
      const color = STATUS_COLORS[sourceStatus] || '#94a3b8'
      return { id: `${e.v}->${e.w}`, source: e.v, target: e.w, type: 'depEdge', style: { stroke: color, strokeWidth: 2 }, animated: sourceStatus === 'RUNNING' }
    })

    return { nodes, edges }
  }, [status, searchQuery])
}
