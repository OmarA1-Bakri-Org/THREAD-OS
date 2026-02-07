'use client'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useUIStore } from '@/lib/ui/store'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  actions?: Array<{
    id: string
    command: string
    description: string
    destructive: boolean
  }>
}

export function ChatPanel() {
  const chatOpen = useUIStore(s => s.chatOpen)
  const toggleChat = useUIStore(s => s.toggleChat)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'system',
      content: 'ThreadOS Chat Orchestrator ready. Describe what you want to do with your sequence, and I\'ll propose seqctl actions.',
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!chatOpen) return null

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, mode: 'plan' }),
      })

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.success
          ? `Sequence "${data.sequenceContext?.name}" has ${data.sequenceContext?.stepCount} steps and ${data.sequenceContext?.gateCount} gates.\n\nSteps:\n${data.sequenceContext?.steps?.map((s: { id: string; status: string; type: string }) => `- ${s.id} (${s.status}) [${s.type}]`).join('\n') || 'None'}\n\nGates:\n${data.sequenceContext?.gates?.map((g: { id: string; status: string }) => `- ${g.id} (${g.status})`).join('\n') || 'None'}\n\nWhat would you like me to do?`
          : `Error: ${data.error}`,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Failed to connect to the chat API. Make sure the server is running.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-sm font-semibold">Chat Orchestrator</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground"
          onClick={toggleChat}
        >
          x
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card className={`max-w-[85%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : msg.role === 'system' ? 'bg-muted' : ''}`}>
              <CardContent className="p-3">
                <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                {msg.actions && msg.actions.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Proposed Actions:</span>
                      {msg.actions.map(action => (
                        <div key={action.id} className="text-[10px] font-mono bg-background/50 rounded p-1">
                          <span className={action.destructive ? 'text-red-500' : 'text-green-500'}>
                            {action.destructive ? '!' : '>'}{' '}
                          </span>
                          {action.command}
                          <p className="text-muted-foreground ml-3">{action.description}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <Card className="bg-muted">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Thinking...
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Describe what you want to do..."
            className="min-h-[60px] max-h-[120px] text-xs resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            size="sm"
            className="self-end h-8"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
