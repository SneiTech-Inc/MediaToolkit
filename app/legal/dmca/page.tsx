import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { getStaticPageMetadata } from '@/lib/metadata'

export const metadata: Metadata = getStaticPageMetadata('dmca')

export default function DmcaPage() {
  return (
    <PageLayout>
      <PageHero
        title="DMCA Notice"
        description="Copyright infringement notification procedures."
      />

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <article
            className="prose max-w-none
              rounded-xl border border-border bg-card p-8 md:p-12"
          >
            <h1 className="text-3xl font-bold mb-2">DMCA Notice &amp; Takedown Policy</h1>
            <p className="text-sm text-muted-foreground mb-8 !mt-0">
              <strong>Last updated:</strong> January 2024
            </p>

            <h2>1. Reporting Copyright Infringement</h2>
            <p>
              SaveVex respects the intellectual property rights of others and expects its
              users to do the same. In accordance with the Digital Millennium Copyright Act
              of 1998 (&quot;DMCA&quot;), we will respond expeditiously to claims of copyright
              infringement that are reported to our designated copyright agent.
            </p>
            <p>
              If you believe that your copyrighted work has been copied in a way that constitutes
              copyright infringement, please notify us with the information specified below.
            </p>

            <h2>2. DMCA Notice Requirements</h2>
            <p>
              To file a DMCA notice, your written communication must include substantially
              the following:
            </p>
            <ul>
              <li>
                A physical or electronic signature of a person authorized to act on behalf
                of the owner of an exclusive right that is allegedly infringed.
              </li>
              <li>
                Identification of the copyrighted work claimed to have been infringed, or,
                if multiple copyrighted works are covered by a single notification, a
                representative list of such works.
              </li>
              <li>
                Identification of the material that is claimed to be infringing and information
                reasonably sufficient to permit us to locate the material.
              </li>
              <li>
                Information reasonably sufficient to permit us to contact you, such as an
                address, telephone number, and email address.
              </li>
              <li>
                A statement that you have a good faith belief that use of the material in
                the manner complained of is not authorized by the copyright owner, its agent,
                or the law.
              </li>
              <li>
                A statement that the information in the notification is accurate, and under
                penalty of perjury, that you are authorized to act on behalf of the owner of
                an exclusive right that is allegedly infringed.
              </li>
            </ul>

            <h2>3. Designated Agent</h2>
            <p>
              DMCA notices should be sent to our designated copyright agent at:
            </p>
            <p>
              <strong>Email:</strong> hello@savevex.com
            </p>
            <p>
              Please note that under Section 512(f) of the DMCA, any person who knowingly
              materially misrepresents that material or activity is infringing may be subject
              to liability.
            </p>

            <h2>4. Counter-Notification</h2>
            <p>
              If you believe that material you posted was removed or access to it was disabled
              by mistake or misidentification, you may file a counter-notification with us.
              Your counter-notification must include:
            </p>
            <ul>
              <li>Your physical or electronic signature.</li>
              <li>
                Identification of the material that has been removed or to which access has
                been disabled and the location at which the material appeared before it was
                removed or disabled.
              </li>
              <li>
                A statement under penalty of perjury that you have a good faith belief that
                the material was removed or disabled as a result of mistake or misidentification.
              </li>
              <li>
                Your name, address, and telephone number, and a statement that you consent to
                the jurisdiction of the federal court in your district.
              </li>
            </ul>

            <h2>5. Repeat Infringer Policy</h2>
            <p>
              In accordance with the DMCA and other applicable law, SaveVex has adopted a
              policy of terminating, in appropriate circumstances, users who are deemed to
              be repeat infringers. We may also at our sole discretion limit access to the
              service and/or terminate accounts of any users who infringe any intellectual
              property rights of others.
            </p>

            <h2>6. Limitation of Liability</h2>
            <p>
              SaveVex is a browser-based tool that processes files locally on your device.
              We do not host user content, and we do not have access to files processed through
              our service. As such, we are not responsible for content that users process
              using our tools. We will, however, respond to valid DMCA notices regarding
              content hosted on our platform (such as our website content, blog, and marketing
              materials).
            </p>

            <h2>7. Contact</h2>
            <p>
              For all DMCA-related inquiries, please contact us at hello@savevex.com.
            </p>
          </article>
        </div>
      </section>
    </PageLayout>
  )
}
