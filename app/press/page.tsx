import type { Metadata } from 'next'
import Link from 'next/link'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { getStaticPageMetadata } from '@/lib/metadata'
import { Download, Mail, FileText, Image } from 'lucide-react'

export const metadata: Metadata = getStaticPageMetadata('press')

const pressReleases = [
  {
    date: 'July 7, 2026',
    title: 'SaveVex Launches Free All-in-One File Toolkit',
    summary:
      'SaveVex officially launched with over 40 tools across seven categories — PDF, Image, Document, Video, Audio, Text, and Utility — all running entirely in the browser for maximum privacy and speed.',
  },
]

const mediaKitAssets = [
  {
    icon: <Image className="w-8 h-8" />,
    title: 'Logo — SVG',
    description: 'Vector format. Scales to any size without quality loss. Recommended for digital use.',
    href: '/savevex-logo.svg',
    label: 'Download SVG',
  },
  {
    icon: <Image className="w-8 h-8" />,
    title: 'Logo — PNG',
    description: 'Raster format with transparent background. 800px wide. Best for presentations and documents.',
    href: '/savevex-logo.png',
    label: 'Download PNG',
  },
  {
    icon: <FileText className="w-8 h-8" />,
    title: 'Brand Guidelines',
    description: 'Colors, typography, logo usage, and brand voice. PDF format. (Coming soon — placeholder.)',
    href: '#',
    label: 'Coming Soon',
    disabled: true,
  },
  {
    icon: <Image className="w-8 h-8" />,
    title: 'Screenshots',
    description: 'High-resolution screenshots of the SaveVex interface for articles and reviews. (Coming soon.)',
    href: '#',
    label: 'Coming Soon',
    disabled: true,
  },
]

export default function PressPage() {
  return (
    <PageLayout>
      <PageHero
        title="Press & Media Kit"
        description="Resources, assets, and information for journalists, bloggers, and partners covering SaveVex."
      />

      {/* About SaveVex */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <SectionHeader
            title="About SaveVex"
            description="What we do and why it matters."
          />

          <div className="prose max-w-none mb-16">
            <p>
              SaveVex is a free, all-in-one file and media toolkit that runs entirely in the browser.
              Founded on the belief that basic file processing should be free, private, and accessible to
              everyone, SaveVex offers over 40 tools across seven categories — PDF, Image, Document,
              Video, Audio, Text, and Utility — with no sign-up, no uploads to remote servers, and no
              usage limits.
            </p>
            <p>
              All processing happens locally on the user&apos;s device using modern web technologies
              including WebAssembly. This approach guarantees complete privacy, instant processing
              with no upload wait times, and the ability to work offline once the page is loaded.
            </p>
          </div>

          {/* Press Releases */}
          <SectionHeader
            title="Press Releases"
            description="Official announcements and company news."
          />

          <div className="space-y-6 mb-16">
            {pressReleases.map((release) => (
              <div
                key={release.title}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary transition-colors"
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {release.date}
                </span>
                <h3 className="text-lg font-semibold mt-1 mb-2">{release.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {release.summary}
                </p>
              </div>
            ))}
          </div>

          {/* Media Kit */}
          <SectionHeader
            title="Media Kit"
            description="Download official SaveVex logos, brand assets, and screenshots."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {mediaKitAssets.map((asset) => (
              <div
                key={asset.title}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary transition-colors flex flex-col"
              >
                <div className="text-primary mb-4">{asset.icon}</div>
                <h3 className="font-semibold mb-2">{asset.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-1">
                  {asset.description}
                </p>
                {asset.disabled ? (
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted px-4 py-2 rounded-lg cursor-not-allowed">
                    <Download className="w-4 h-4" />
                    {asset.label}
                  </span>
                ) : (
                  <a
                    href={asset.href}
                    download
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <Download className="w-4 h-4" />
                    {asset.label}
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Team */}
          <SectionHeader
            title="Our Team"
            description="The people behind SaveVex."
          />

          <div className="p-6 rounded-xl border border-border bg-card hover:border-primary transition-colors mb-16">
            <h3 className="text-lg font-semibold mb-2">Built by Sneitech Inc.</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              SaveVex is developed and maintained by Sneitech Inc., a software company focused on
              building privacy-respecting, browser-based productivity tools. Our team believes that
              powerful software doesn&apos;t need to collect your data to work well. We&apos;re
              headquartered in Ghana and are always working on new tools and
              improvements.
            </p>
          </div>

          {/* Press Contact */}
          <SectionHeader
            title="Press Contact"
            description="Get in touch for media inquiries, interviews, or partnership opportunities."
          />

          <div className="p-6 rounded-xl border border-border bg-card hover:border-primary transition-colors">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Email the Press Team</h3>
                <p className="text-muted-foreground text-sm mb-3">
                  We respond to press inquiries within 24 hours on business days.
                </p>
                <a
                  href="mailto:press@savevex.com"
                  className="text-primary font-medium hover:underline text-sm"
                >
                  support@savevex.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
