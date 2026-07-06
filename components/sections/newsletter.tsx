'use client'

import { NewsletterForm } from '@/components/shared/NewsletterForm'

export function Newsletter() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 dark:from-primary/10 dark:via-accent/10 dark:to-primary/10 border-y border-border">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 text-center">
          Stay Updated
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto text-center">
          Get the latest tips, updates, and new features delivered to your inbox every week.
        </p>
        <NewsletterForm variant="newsletter" />
      </div>
    </section>
  )
}
