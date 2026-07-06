import Link from 'next/link'

interface PageHeroProps {
  title: string
  description: string
  icon?: string
  backHref?: string
  backLabel?: string
}

/**
 * Gradient hero banner used at the top of category, tool, blog, and premium pages.
 * Replaces duplicated gradient header sections across 4+ pages.
 */
export function PageHero({ title, description, icon, backHref, backLabel }: PageHeroProps) {
  return (
    <section className="bg-gradient-to-b from-primary/10 to-accent/5 py-16 px-4 border-b border-border">
      <div className="max-w-6xl mx-auto text-center">
        {backHref && backLabel && (
          <Link
            href={backHref}
            className="text-sm text-muted-foreground hover:text-primary mb-4 inline-block"
          >
            ← Back to {backLabel}
          </Link>
        )}
        {icon && <div className="text-5xl mb-4">{icon}</div>}
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
          {description}
        </p>
      </div>
    </section>
  )
}
