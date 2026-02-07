'use client'
import { Group, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { SequenceCanvas } from '@/components/canvas/SequenceCanvas'
import { StepInspector } from '@/components/inspector/StepInspector'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { useUIStore } from '@/lib/ui/store'

export default function Home() {
  const inspectorOpen = useUIStore((s) => s.inspectorOpen)
  const chatOpen = useUIStore((s) => s.chatOpen)

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Top Toolbar */}
      <Toolbar />

      {/* Main Content: Canvas + Inspector + Chat */}
      <Group orientation="horizontal" className="flex-1">
        {/* Canvas Panel */}
        <Panel id="canvas" defaultSize={inspectorOpen || chatOpen ? 60 : 100} minSize={30}>
          <SequenceCanvas />
        </Panel>

        {/* Inspector Panel */}
        {inspectorOpen && (
          <>
            <PanelResizeHandle className="bg-border data-[resize-handle-state=hover]:bg-primary/20 data-[resize-handle-state=drag]:bg-primary/30 transition-colors w-1.5" />
            <Panel id="inspector" defaultSize={25} minSize={15} maxSize={45}>
              <div className="h-full border-l bg-card overflow-hidden">
                <StepInspector />
              </div>
            </Panel>
          </>
        )}

        {/* Chat Panel */}
        {chatOpen && (
          <>
            <PanelResizeHandle className="bg-border data-[resize-handle-state=hover]:bg-primary/20 data-[resize-handle-state=drag]:bg-primary/30 transition-colors w-1.5" />
            <Panel id="chat" defaultSize={25} minSize={15} maxSize={45}>
              <ChatPanel />
            </Panel>
          </>
        )}
      </Group>
    </div>
  )
}
