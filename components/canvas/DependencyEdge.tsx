'use client'

import { memo } from 'react'
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react'

function DependencyEdgeComponent(props: EdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX: props.sourceX, sourceY: props.sourceY,
    targetX: props.targetX, targetY: props.targetY,
  })

  return <BaseEdge path={edgePath} style={props.style} />
}

export const DependencyEdge = memo(DependencyEdgeComponent)
