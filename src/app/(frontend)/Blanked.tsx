import React, { Fragment } from 'react'

/** Shows a question with each run of underscores as a styled blank. */
export function Blanked({ text }: { text: string }) {
  const parts = text.split(/_{3,}/)
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <span className="blank" role="img" aria-label="blank" />}
        </Fragment>
      ))}
    </>
  )
}
