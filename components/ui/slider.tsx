'use client'

import * as React from 'react'
import { Slider as BaseSlider } from '@base-ui/react/slider'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SliderProps {
  /** Minimum value. */
  min: number
  /** Maximum value. */
  max: number
  /** Step increment (supports decimals). */
  step: number
  /** Current values — two elements for a dual-handle range slider. */
  value: readonly [number, number]
  /** Called when the user drags either handle. */
  onValueChange: (value: [number, number]) => void
  /** Whether the slider is disabled. */
  disabled?: boolean
  /** Optional className for the root element. */
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Dual-handle range slider built on @base-ui/react.
 *
 * Usage:
 * ```tsx
 * <Slider
 *   min={0}
 *   max={100}
 *   step={0.1}
 *   value={[startValue, endValue]}
 *   onValueChange={([start, end]) => { ... }}
 * />
 * ```
 */
export function Slider({
  min,
  max,
  step,
  value,
  onValueChange,
  disabled = false,
  className,
}: SliderProps) {
  return (
    <BaseSlider.Root
      value={value as readonly number[]}
      onValueChange={(newValue) => {
        // @base-ui/react passes the full array for range sliders
        const arr = newValue as readonly number[]
        if (arr.length >= 2) {
          onValueChange([arr[0], arr[1]])
        }
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      minStepsBetweenValues={0}
      className={cn('relative flex w-full touch-none select-none items-center', className)}
    >
      <BaseSlider.Control className="relative flex w-full items-center h-5">
        {/* Track background */}
        <BaseSlider.Track className="relative h-1.5 w-full rounded-full bg-muted">
          {/* Filled range indicator */}
          <BaseSlider.Indicator className="absolute h-full rounded-full bg-primary" />
        </BaseSlider.Track>

        {/* Start thumb */}
        <BaseSlider.Thumb
          className={cn(
            'block h-5 w-5 rounded-full border-2 border-primary bg-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'transition-shadow hover:shadow-md',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />

        {/* End thumb */}
        <BaseSlider.Thumb
          className={cn(
            'block h-5 w-5 rounded-full border-2 border-primary bg-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'transition-shadow hover:shadow-md',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}
