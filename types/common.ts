export interface PageMeta {
  title: string
  description: string
  ogImage?: string
  canonical?: string
}

export interface NavLink {
  label: string
  href: string
  external?: boolean
}

export interface FAQItem {
  question: string
  answer: string
}

export interface BlogPost {
  title: string
  excerpt: string
  date: string
  category: string
  slug: string
  content: string
  readingTime: string
}

export interface TrustBadge {
  title: string
  description: string
  icon: string
}

export interface Feature {
  icon: string
  title: string
  description: string
}

export interface HowItWorksStep {
  step: number
  title: string
  description: string
}

export type SupportFrequency = 'one-time' | 'monthly'

export interface SupportTier {
  amountUSD: number
  amountGHS: number
  amountPesewas: number
}
