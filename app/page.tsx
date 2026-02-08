'use client'

import { Group, Panel, Separator } from 'react-resizable-panels'
import { SequenceCanvas } from '@/components/canvas/SequenceCanvas'
import { StepInspector } from '@/components/inspector/StepInspector'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useUIStore } from '@/lib/ui/store'

export default function Home() {
  const inspectorOpen = useUIStore(s => s.inspectorOpen)
  const chatOpen = useUIStore(s => s.chatOpen)

  return (
    <div className="h-screen flex flex-col">
      <Toolbar />
      <Group orientation="vertical" className="flex-1">
        <Panel defaultSize={chatOpen ? 70 : 100} minSize={30}>
          <Group orientation="horizontal" className="h-full">
            <Panel defaultSize={inspectorOpen ? 70 : 100} minSize={40}>
              <ErrorBoundary>
                <SequenceCanvas />
              </ErrorBoundary>
            </Panel>
            <Separator className={inspectorOpen ? '' : 'hidden'} />
            <Panel defaultSize={30} minSize={20} className={inspectorOpen ? '' : 'hidden'}>
              <ErrorBoundary>
                <div className="h-full overflow-auto border-l" style={{ display: inspectorOpen ? 'block' : 'none' }}>
                  <StepInspector />
                </div>
              </ErrorBoundary>
            </Panel>
          </Group>
        </Panel>
        <Separator className={chatOpen ? '' : 'hidden'} />
        <Panel defaultSize={30} minSize={15} className={chatOpen ? '' : 'hidden'}>
          <div className="h-full border-t" style={{ display: chatOpen ? 'block' : 'none' }}>
            <ErrorBoundary>
              <ChatPanel />
            </ErrorBoundary>
          </div>
        </Panel>
      </Group>
    </div>
  )
}
