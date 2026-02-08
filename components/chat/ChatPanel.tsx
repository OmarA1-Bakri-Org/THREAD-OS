'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatInput } from './ChatInput'
import { MessageBubble } from './MessageBubble'
import { ActionCard } from './ActionCard'
import { DiffPreview } from './DiffPreview'
import type { ProposedAction } from '@/lib/chat/validator'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: ProposedAction[]
  diff?: string
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let assistantContent = ''
      let actions: ProposedAction[] = []
      let diff = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'message') assistantContent += event.data.content
            if (event.type === 'actions') actions = event.data.actions
            if (event.type === 'diff') diff = event.data.diff
          } catch {
            // ignore parse errors on partial chunks
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantContent,
        actions: actions.length > 0 ? actions : undefined,
        diff: diff || undefined,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${(error as Error).message}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleApply = useCallback(async (actions: ProposedAction[]) => {
    // TODO: call validator.apply() via API
    console.log('Apply actions:', actions)
  }, [])

  const handleDiscard = useCallback(() => {
    // No-op, just dismisses
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b text-sm font-medium">Chat</div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground text-center mt-4">
            Ask me to modify your sequence...
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageBubble role={msg.role} content={msg.content} />
            {msg.actions && (
              <ActionCard
                actions={msg.actions}
                onApply={handleApply}
                onDiscard={handleDiscard}
              />
            )}
            {msg.diff && <DiffPreview diff={msg.diff} />}
          </div>
        ))}
        {loading && (
          <div className="text-xs text-muted-foreground animate-pulse">
            Thinking...
          </div>
        )}
      </div>
      <ChatInput onSend={sendMessage} disabled={loading} />
    </div>
  )
}
