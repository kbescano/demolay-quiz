import type { Metadata, Viewport } from 'next'
import { Anton, Archivo } from 'next/font/google'
import React from 'react'

import { getSite, type SiteView } from '@/lib/quiz'

import './styles.css'

// Render every page on each request, so changes made in the admin (title, logo, questions,
// timer) show up immediately instead of being frozen at build time.
export const dynamic = 'force-dynamic'

const display = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display', display: 'swap' })
const body = Archivo({ subsets: ['latin'], variable: '--font-body', display: 'swap' })

/** The tab title and description follow Quiz settings. */
export async function generateMetadata(): Promise<Metadata> {
  // A settings hiccup must never take the page down, so fall back to plain defaults.
  const site = await getSite().catch((): SiteView | null => null)
  const title = site?.title || "Petitioners' Quiz"
  const seconds = site?.seconds ?? 15

  return {
    title: { default: title, template: `%s · ${title}` },
    description: `Test your knowledge of the Order of DeMolay. ${seconds} seconds a question.`,
    robots: { index: false, follow: false },
  }
}

export const viewport: Viewport = {
  themeColor: '#131873',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
