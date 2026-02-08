'use client'

import { Group, Panel, Separator } from 'react-resizable-panels'
import { SequenceCanvas } from '@/components/canvas/SequenceCanvas'
import { StepInspector } from '@/components/inspector/StepInspector'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { useUIStore } from '@/lib/ui/store'

export default function Home() {
  const inspectorOpen = useUIStore(s => s.inspectorOpen)

  return (
    <div className="h-screen flex flex-col">
      <Toolbar />
      <Group orientation="horizontal" className="flex-1">
        <Panel defaultSize={inspectorOpen ? 70 : 100} minSize={40}>
          <SequenceCanvas />
        </Panel>
        {inspectorOpen && (
          <>
            <Separator />
            <Panel defaultSize={30} minSize={20}>
              <div className="h-full overflow-auto border-l">
                <StepInspector />
              </div>
            </Panel>
          </>
        )}
      </Group>
    </div>
  )
}
