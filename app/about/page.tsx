import type { Metadata } from 'next'
import Image from 'next/image'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { getStaticPageMetadata } from '@/lib/metadata'

export const metadata: Metadata = getStaticPageMetadata('about')

const values = [
  {
    icon: '🔒',
    title: 'Privacy First',
    description:
      'All processing happens locally in your browser. Your files never leave your device — not to our servers, not to any third party.',
  },
  {
    icon: '💯',
    title: 'Free Forever',
    description:
      'We believe essential file tools should be accessible to everyone, for free. No paywalls, no usage limits, no watermarks.',
  },
  {
    icon: '⚡',
    title: 'Performance',
    description:
      'Built with modern web technologies including WebAssembly for the fastest possible processing, right in your browser.',
  },
  {
    icon: '🌍',
    title: 'Accessibility',
    description:
      'Works on any device with a modern browser — no installation, no sign-up, no strings attached.',
  },
  {
    icon: '🤝',
    title: 'Honesty & Hard Work',
    description:
      'We believe in transparency about how our tools work and technical excellence in everything we build. No hidden catches, no dark patterns.',
  },
  {
    icon: '💡',
    title: 'Impactful Innovation',
    description:
      'We solve real problems through meaningful experiences — not feature checklists or hype. Every tool exists because someone genuinely needed it.',
  },
]

export default function AboutPage() {
  return (
    <PageLayout>
      <PageHero
        title="About SaveVex"
        description="We're on a mission to make file processing free, private, and accessible to everyone."
      />

      {/* ── Who We Are ── */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <SectionHeader
            title="Who We Are"
            description="SaveVex is built by SneiTech Inc., a product‑development company creating software that respects your privacy."
          />

          <div className="prose max-w-none mb-16">
            <p>
              <strong>SneiTech Inc.</strong> is a product‑driven innovation hub — a parent
              company that births multiple software solutions. Founded by Michael Schneider and
              based in Ghana, we serve clients and users worldwide with tools built on a simple
              philosophy: lead with creativity, innovation, and purpose.
            </p>
            <p>
              SaveVex is one of SneiTech's flagship products. Every tool on SaveVex was designed
              and built by our team with one overriding constraint: your files must never leave your
              device. No uploads, no server processing, no compromises.
            </p>
          </div>

          {/* ── Our Mission ── */}
          <SectionHeader
            title="Our Mission"
            description="Build innovative digital products that connect people, empower businesses, and shape the future of technology."
          />

          <div className="prose max-w-none mb-16">
            <p>
              Every day, millions of people need to compress a PDF, convert an image, or trim a
              video. Most existing tools either require uploading files to remote servers, charge
              subscription fees, or force users to install bloated software.
            </p>
            <p>
              SaveVex takes a different approach. By leveraging modern browser APIs and WebAssembly,
              we run all processing directly on your device. Your files never leave your browser —
              which means they're faster, more private, and completely free.
            </p>
            <p>
              Our specific mission with SaveVex: make professional‑grade file processing accessible
              to everyone — completely free, private, and simple. No sign‑up, no uploads, no fine
              print.
            </p>
          </div>

          {/* ── Our Philosophy ── */}
          <SectionHeader
            title="Our Philosophy"
            description="Two principles guide everything we build."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary transition-colors">
              <h3 className="text-lg font-semibold mb-2">Honesty & Hard Work</h3>
              <p className="text-muted-foreground text-sm">
                We are transparent about how our tools work and what happens to your data (nothing —
                it stays on your device). We put in the engineering effort to build things right
                rather than cutting corners. There are no hidden catches, no dark patterns, and no
                features designed to upsell you into a paid plan that doesn't exist.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary transition-colors">
              <h3 className="text-lg font-semibold mb-2">Impactful Innovation</h3>
              <p className="text-muted-foreground text-sm">
                We solve real problems through meaningful experiences. Every tool on SaveVex exists
                because someone genuinely needed it — not because a feature checklist said so. We
                focus on making things work well, consistently, and intuitively, across every device
                and browser.
              </p>
            </div>
          </div>

          {/* ── Meet the Team ── */}
          <SectionHeader
            title="Meet the Team"
            description="The people behind SaveVex."
          />

          <div className="flex flex-col items-center mb-16">
            <div className="relative w-32 h-32 mb-4 rounded-full overflow-hidden border-2 border-primary/20">
              <Image
                src="/images/authors/michael-schneider.jpg"
                alt="Michael Schneider - Founder & CEO of SneiTech Inc."
                fill
                className="object-cover"
              />
            </div>
            <h3 className="text-xl font-semibold">Michael Schneider</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Founder & CEO, SneiTech Inc.
            </p>
            <blockquote className="text-center text-muted-foreground italic max-w-md">
              &ldquo;Our goal is to lead with creativity, innovation, and purpose.&rdquo;
            </blockquote>
            <p className="text-sm text-muted-foreground mt-3 max-w-md text-center">
              Michael has over 10 years of experience in full‑stack development, file‑processing
              technologies, and digital product creation. He personally designed and built every tool
              on SaveVex with a focus on privacy, simplicity, and real‑world utility.
            </p>
          </div>

          {/* ── Our Values ── */}
          <SectionHeader title="Our Values" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value) => (
              <div
                key={value.title}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary transition-colors"
              >
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
