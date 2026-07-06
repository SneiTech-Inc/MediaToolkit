'use client'

import { Component, type ReactNode } from 'react'
import { ErrorCard } from '@/components/shared/ErrorCard'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React error boundary that wraps individual tool pages.
 * Catches rendering errors and shows ErrorCard instead of a white screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorCard
          title="Tool Error"
          message={this.state.error?.message || 'An unexpected error occurred in this tool.'}
          onRetry={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}
