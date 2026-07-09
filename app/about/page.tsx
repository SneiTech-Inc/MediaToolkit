import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { getStaticPageMetadata } from '@/lib/metadata'

export const metadata: Metadata = getStaticPageMetadata('about')

const values = [
  { icon: '🔒', title: 'Privacy First', description: 'All processing happens locally in your browser. Your files never leave your device.' },
  { icon: '💯', title: 'Free Forever', description: 'We believe essential file tools should be accessible to everyone, for free.' },
  { icon: '⚡', title: 'Performance', description: 'Built with modern web technologies for the fastest possible processing.' },
  { icon: '🌍', title: 'Accessibility', description: 'Works on any device with a modern browser — no installation needed.' },
]

export default function AboutPage() {
  return (
    <PageLayout>
      <PageHero
        title="About SaveVex"
        description="We're on a mission to make file processing free, private, and accessible to everyone."
      />

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <SectionHeader
            title="Our Mission"
            description="SaveVex was built to give everyone access to powerful file processing tools without compromising privacy or requiring payment."
          />

          <div className="prose max-w-none mb-16">
            <p>
              Every day, millions of people need to compress a PDF, convert an image, or trim a video.
              Most existing tools either require uploading files to remote servers, charge subscription fees,
              or force users to install bloated software.
            </p>
            <p>
              SaveVex takes a different approach. By leveraging modern browser APIs and WebAssembly,
              we run all processing directly on your device. Your files never leave your browser —
              which means they're faster, more private, and completely free.
            </p>
          </div>

          <SectionHeader title="Our Values" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value) => (
              <div key={value.title} className="p-6 rounded-xl border border-border bg-card hover:border-primary transition-colors">
                <div className="text-3xl mb-3">{value.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
