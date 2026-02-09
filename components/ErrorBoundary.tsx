'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="mt-3 px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                Try again
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
