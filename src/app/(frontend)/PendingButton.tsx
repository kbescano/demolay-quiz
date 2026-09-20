'use client'

import React from 'react'
import { useFormStatus } from 'react-dom'

/** A submit button that disables itself while its form is being processed. */
export function PendingButton({ children, pendingText = 'Starting…' }: { children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus()
  return (
    <button className="btn btn--block" type="submit" disabled={pending}>
      {pending ? pendingText : children}
    </button>
  )
}
