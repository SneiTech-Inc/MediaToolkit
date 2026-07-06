'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { FAQItem } from '@/types/common'
import { SectionHeader } from '@/components/shared/SectionHeader'

interface FAQSectionProps {
  faqs: readonly FAQItem[]
  title?: string
  description?: string
  contactCta?: boolean
}

/**
 * Reusable FAQ accordion. Used in the marketing FAQ section and on individual tool pages.
 * Supports optional contact CTA at the bottom.
 */
export function FAQSection({
  faqs,
  title = 'Frequently Asked Questions',
  description = 'Find answers to common questions about SaveVex',
  contactCta = false,
}: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div>
      <SectionHeader title={title} description={description} />

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className="border border-border rounded-lg overflow-hidden hover:border-primary transition-colors"
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full p-6 text-left flex items-center justify-between hover:bg-muted/50 transition-colors group"
            >
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors pr-4">
                {faq.question}
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-primary flex-shrink-0 transition-transform duration-300 ${
                  openIndex === index ? 'transform rotate-180' : ''
                }`}
              />
            </button>

            {openIndex === index && (
              <div className="px-6 pb-6 border-t border-border bg-card">
                <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {contactCta && (
        <div className="mt-16 text-center p-8 rounded-xl bg-card border border-border">
          <h3 className="text-xl font-semibold text-foreground mb-3">
            Didn&apos;t find your answer?
          </h3>
          <p className="text-muted-foreground mb-6">
            Our support team is here to help. Get in touch with us anytime.
          </p>
          <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold transition-colors">
            Contact Support
          </button>
        </div>
      )}
    </div>
  )
}
