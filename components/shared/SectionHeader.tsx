interface SectionHeaderProps {
  title: string
  description?: string
  className?: string
}

/**
 * Centered section heading used in every marketing section.
 * Eliminates the duplicated h2+p pattern across blog, features, faq, how-it-works.
 */
export function SectionHeader({ title, description, className = '' }: SectionHeaderProps) {
  return (
    <div className={`text-center mb-16 ${className}`}>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
        {title}
      </h2>
      {description && (
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {description}
        </p>
      )}
    </div>
  )
}
