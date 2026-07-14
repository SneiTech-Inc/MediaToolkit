import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getStaticPageMetadata } from '@/lib/metadata'
import { Mail, MessageCircle, Globe } from 'lucide-react'

export const metadata: Metadata = getStaticPageMetadata('contact')

export default function ContactPage() {
  return (
    <PageLayout>
      <PageHero
        title="Contact Us"
        description="Have questions, suggestions, or feedback? We'd love to hear from you."
      />

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Send us a message</h2>
            <form className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input type="text" placeholder="Your name" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input type="email" placeholder="you@example.com" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input type="text" placeholder="How can we help?" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Message</label>
                <textarea
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background min-h-[120px] resize-y"
                  placeholder="Tell us what's on your mind..."
                />
              </div>
              <Button type="submit" disabled className="bg-primary hover:bg-primary/90 w-full">
                Send Message
              </Button>
            </form>
          </div>

          {/* Contact Info */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Other ways to reach us</h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Mail className="w-6 h-6 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold">Email</h3>
                  <p className="text-muted-foreground">sneitechinc@gmail.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <MessageCircle className="w-6 h-6 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold">Discord Community</h3>
                  <p className="text-muted-foreground">Join our community for tips and support.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Globe className="w-6 h-6 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold">Twitter / X</h3>
                  <p className="text-muted-foreground">Follow @SaveVex for updates and announcements.</p>
                </div>
              </div>
            </div>

            <div className="mt-12 p-6 rounded-xl border border-border bg-muted/30">
              <h3 className="font-semibold mb-2">Response Time</h3>
              <p className="text-muted-foreground text-sm">
                We typically respond within 24-48 hours during business days. For urgent matters,
                reach out via Discord for faster assistance.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
