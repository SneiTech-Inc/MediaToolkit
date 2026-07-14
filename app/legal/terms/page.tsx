import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { getStaticPageMetadata } from '@/lib/metadata'

export const metadata: Metadata = getStaticPageMetadata('terms')

export default function TermsPage() {
  return (
    <PageLayout>
      <PageHero
        title="Terms of Service"
        description="The terms and conditions for using SaveVex services."
      />

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <article
            className="prose max-w-none
              rounded-xl border border-border bg-card p-8 md:p-12"
          >
            <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
            <p className="text-sm text-muted-foreground mb-8 !mt-0">
              <strong>Last updated:</strong> July 2026
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using SaveVex, you agree to be bound by these Terms of Service.
              If you do not agree with any part of these terms, please do not use the service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              SaveVex provides free, browser-based file processing tools. The service is provided
              &quot;as is&quot; without warranties of any kind, either express or implied.
            </p>

            <h2>3. User Responsibilities</h2>
            <p>
              You are responsible for the files you process using SaveVex. You agree not to use
              the service for any unlawful purpose or in violation of any applicable laws or regulations.
            </p>

            <h2>4. Intellectual Property</h2>
            <p>
              SaveVex does not claim ownership of any files you process. You retain all rights to
              your content. The SaveVex name, logo, and website are protected by copyright and
              trademark laws.
            </p>

            <h2>5. Limitation of Liability</h2>
            <p>
              SaveVex shall not be liable for any indirect, incidental, special, or consequential
              damages arising from the use or inability to use the service. All processing is
              done locally on your device, and SaveVex has no access to or control over your files.
            </p>

            <h2>6. Service Availability</h2>
            <p>
              While we strive to maintain high availability, SaveVex may be temporarily unavailable
              due to maintenance or circumstances beyond our control. We reserve the right to modify
              or discontinue the service at any time.
            </p>

            <h2>7. Changes to Terms</h2>
            <p>
              We reserve the right to update these terms at any time. Continued use of the service
              after changes constitutes acceptance of the updated terms.
            </p>

            <h2>8. Contact</h2>
            <p>
              For questions about these terms, please contact us at sneitechinc@gmail.com.
            </p>
          </article>
        </div>
      </section>
    </PageLayout>
  )
}
