import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { getStaticPageMetadata } from '@/lib/metadata'

export const metadata: Metadata = getStaticPageMetadata('cookies')

export default function CookiesPage() {
  return (
    <PageLayout>
      <PageHero
        title="Cookie Policy"
        description="How SaveVex uses cookies and similar technologies."
      />

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <article
            className="prose max-w-none
              rounded-xl border border-border bg-card p-8 md:p-12"
          >
            <h1 className="text-3xl font-bold mb-2">Cookie Policy</h1>
            <p className="text-sm text-muted-foreground mb-8 !mt-0">
              <strong>Last updated:</strong> July 2026
            </p>

            <h2>1. What Are Cookies</h2>
            <p>
              Cookies are small text files that are stored on your device when you visit a website.
              They are widely used to make websites work more efficiently and provide information
              to the site owners. Cookies can be &quot;persistent&quot; or &quot;session&quot; cookies.
            </p>

            <h2>2. How We Use Cookies</h2>
            <p>
              SaveVex uses cookies for essential functionality only. We do not use
              tracking cookies, advertising cookies, or any cookies that collect personal
              information. Our use of cookies is limited to what is necessary for the
              website to function properly.
            </p>

            <h2>3. Essential Cookies</h2>
            <p>
              These cookies are necessary for the website to function and cannot be switched
              off in our systems. They are usually only set in response to actions you take,
              such as setting your privacy preferences or navigating the site.
            </p>
            <p>
              SaveVex uses essential cookies for:
            </p>
            <ul>
              <li>Storing your theme preference (light or dark mode)</li>
              <li>Maintaining your session while using our tools</li>
              <li>Remembering your recently used tools for quick access</li>
            </ul>

            <h2>4. Analytics Cookies</h2>
            <p>
              We use Vercel Analytics to collect anonymous usage data. These cookies help us
              understand how visitors interact with our website by collecting and reporting
              information anonymously. This data includes:
            </p>
            <ul>
              <li>Pages visited and tools used</li>
              <li>Time spent on the site</li>
              <li>Browser and device information (anonymized)</li>
              <li>General geographic region (country level only)</li>
            </ul>
            <p>
              No personal data is collected through these analytics cookies. They cannot be
              used to identify you personally.
            </p>

            <h2>5. Third-Party Cookies</h2>
            <p>
              SaveVex does not use any third-party advertising or tracking cookies. The only
              third-party service that may set cookies is Vercel Analytics, which operates on our
              behalf and does not share data with any other third parties.
            </p>

            <h2>6. Managing Cookies</h2>
            <p>
              Most web browsers allow you to control cookies through their settings preferences.
              You can set your browser to refuse cookies, delete cookies, or alert you when
              cookies are being sent. However, disabling essential cookies may affect the
              functionality of SaveVex.
            </p>
            <p>
              To learn more about managing cookies, visit the help pages for your browser:
            </p>
            <ul>
              <li>Google Chrome</li>
              <li>Mozilla Firefox</li>
              <li>Apple Safari</li>
              <li>Microsoft Edge</li>
            </ul>

            <h2>7. Updates to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in our
              practices or for operational, legal, or regulatory reasons. We encourage you
              to review this policy periodically.
            </p>

            <h2>8. Contact</h2>
            <p>
              If you have any questions about our use of cookies or this policy, please
              contact us at sneitechinc@gmail.com.
            </p>
          </article>
        </div>
      </section>
    </PageLayout>
  )
}
