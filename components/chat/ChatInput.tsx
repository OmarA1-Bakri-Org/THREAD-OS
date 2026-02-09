'use client'

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }, [value])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="flex items-end gap-2 p-2 border-t">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your sequence..."
        disabled={disabled}
        rows={1}
        className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 resize-none"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="p-2 rounded-md hover:bg-accent disabled:opacity-50"
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  )
}
