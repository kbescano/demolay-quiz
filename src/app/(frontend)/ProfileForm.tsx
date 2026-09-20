'use client'

import React, { useActionState } from 'react'

import { saveProfileAction, type ProfileState } from './actions'

/** Shown once, right after the first Google login. */
export function ProfileForm({ suggestedName }: { suggestedName: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfileAction, {})

  return (
    <form className="form" action={action} noValidate>
      <div className="field">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={80}
          required
          defaultValue={state.name ?? suggestedName}
          placeholder="Juan dela Cruz"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? 'profile-error' : undefined}
        />
      </div>
      <div className="field">
        <label htmlFor="chapter">Chapter</label>
        <input
          id="chapter"
          name="chapter"
          type="text"
          autoComplete="organization"
          maxLength={120}
          required
          defaultValue={state.chapter}
          placeholder="A. Mabini Chapter"
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? 'profile-error' : undefined}
        />
      </div>
      {state.error && (
        <p id="profile-error" className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn--block" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save and continue'}
      </button>
    </form>
  )
}
