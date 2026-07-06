import { FAQSection } from '@/components/shared/FAQSection'
import { FAQS } from '@/lib/constants'

export function FAQ() {
  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50/50 dark:from-blue-950/20 via-background to-background">
      <div className="max-w-3xl mx-auto">
        <FAQSection faqs={FAQS} contactCta />
      </div>
    </section>
  )
}
