'use client'

import { ReactFlow, MiniMap, Controls, Background } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStatus } from '@/lib/ui/api'
import { useUIStore } from '@/lib/ui/store'
import { useSequenceGraph } from './useSequenceGraph'
import { StepNode } from './StepNode'
import { GateNode } from './GateNode'
import { DependencyEdge } from './DependencyEdge'

const nodeTypes = { stepNode: StepNode, gateNode: GateNode }
const edgeTypes = { depEdge: DependencyEdge }

export function SequenceCanvas() {
  const { data: status } = useStatus()
  const searchQuery = useUIStore(s => s.searchQuery)
  const minimapVisible = useUIStore(s => s.minimapVisible)
  const { nodes, edges } = useSequenceGraph(status, searchQuery)

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <Background />
        {minimapVisible && <MiniMap />}
      </ReactFlow>
    </div>
  )
}
