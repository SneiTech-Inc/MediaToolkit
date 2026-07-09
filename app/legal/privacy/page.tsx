import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { getStaticPageMetadata } from '@/lib/metadata'

export const metadata: Metadata = getStaticPageMetadata('privacy')

export default function PrivacyPage() {
  return (
    <PageLayout>
      <PageHero
        title="Privacy Policy"
        description="How SaveVex protects your privacy and handles your data."
      />

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <article
            className="prose max-w-none
              rounded-xl border border-border bg-card p-8 md:p-12"
          >
            <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mb-8 !mt-0">
              <strong>Last updated:</strong> January 2024
            </p>

            <h2>1. Our Privacy Commitment</h2>
            <p>
              SaveVex is designed from the ground up with privacy as a core principle.
              All file processing happens entirely within your browser — your files are
              never uploaded to any server, and we never have access to them.
            </p>

            <h2>2. Data We Collect</h2>
            <p>
              SaveVex does not require user accounts, and we do not collect personal information.
              We may collect anonymous usage analytics (page views, feature usage) through
              Vercel Analytics to improve the product. This data cannot be used to identify you.
            </p>

            <h2>3. Local Processing</h2>
            <p>
              All file processing occurs locally on your device using browser APIs and WebAssembly.
              Your files are never transmitted to SaveVex servers or any third party. You can verify
              this by disconnecting from the internet after the page loads — all tools will continue to work.
            </p>

            <h2>4. Local Storage</h2>
            <p>
              SaveVex may store preferences (such as theme preference and recently used tools)
              in your browser's localStorage. This data never leaves your device and can be
              cleared at any time through your browser settings.
            </p>

            <h2>5. Cookies</h2>
            <p>
              SaveVex uses minimal cookies for essential functionality. We do not use
              tracking cookies or advertising cookies.
            </p>

            <h2>6. Third-Party Services</h2>
            <p>
              We use Vercel Analytics for anonymous usage statistics. No personal data
              is shared with any third-party service.
            </p>

            <h2>7. Contact</h2>
            <p>
              If you have questions about this privacy policy, please contact us at
              hello@savevex.com.
            </p>
          </article>
        </div>
      </section>
    </PageLayout>
  )
}
