import { cn } from '@/lib/utils'

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export interface AuthorBioProps {
  className?: string
}

export function AuthorBio({ className }: AuthorBioProps) {
  return (
    <aside
      className={cn('mt-8 pt-6 border-t border-border', className)}
      aria-label="About the author"
    >
      <div className="flex items-start gap-4 p-5 bg-muted/30 rounded-xl">
        <img
          src="/images/authors/michael-schneider.jpg"
          alt="Michael Schneider"
          className="w-14 h-14 rounded-full object-cover flex-shrink-0"
        />
        <div className="space-y-1.5">
          <h4 className="font-semibold text-sm">Michael Schneider</h4>
          <p className="text-xs text-muted-foreground">
            Founder &amp; CEO, SneiTech Inc.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Michael builds privacy-first file processing tools. With over 10
            years of experience in full‑stack development and file‑processing
            technologies, he personally uses every tool on SaveVex to ensure
            quality and reliability.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <a
              href="https://www.linkedin.com/company/sneitech/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors"
            >
              <LinkedInIcon className="w-3.5 h-3.5" />
              Follow on LinkedIn
            </a>
            <a
              href="https://x.com/sneitech"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors"
            >
              <XIcon className="w-3.5 h-3.5" />
              Follow on X
            </a>
          </div>
        </div>
      </div>
    </aside>
  )
}
