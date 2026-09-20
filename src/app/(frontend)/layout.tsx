import type { Metadata, Viewport } from 'next'
import { Anton, Archivo } from 'next/font/google'
import React from 'react'

import './styles.css'

const display = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display', display: 'swap' })
const body = Archivo({ subsets: ['latin'], variable: '--font-body', display: 'swap' })

export const metadata: Metadata = {
  title: { default: "Petitioners' Quiz", template: "%s · Petitioners' Quiz" },
  description: 'Test your knowledge of the Order of DeMolay. Fifteen seconds a question.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
