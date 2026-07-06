import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { NewsletterForm } from '@/components/shared/NewsletterForm'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    description: 'Forever free for everyone',
    price: '$0',
    features: ['50+ tools', '100% browser-based', 'No sign-up required', 'No ads'],
    cta: 'Get Started',
    featured: false,
    comingSoon: false,
  },
  {
    name: 'Pro',
    description: 'For power users',
    price: '$4.99',
    period: '/mo',
    features: ['Everything in Free', 'Batch processing', 'Priority processing', 'API access'],
    cta: 'Coming Soon',
    featured: true,
    comingSoon: true,
  },
  {
    name: 'Enterprise',
    description: 'For teams and businesses',
    price: 'Custom',
    features: ['Everything in Pro', 'Dedicated support', 'Custom integration', 'SLA guarantee'],
    cta: 'Contact Sales',
    featured: false,
    comingSoon: true,
  },
]

export default function PremiumPage() {
  return (
    <PageLayout>
      <PageHero
        title="Premium Features Coming Soon"
        description="Get early access to exclusive features and unlimited processing power."
      />

      {/* Plans */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-8 ${
                  plan.featured
                    ? 'border-2 border-primary bg-gradient-to-b from-primary/5 to-transparent'
                    : 'border border-border bg-card'
                }`}
              >
                {plan.comingSoon && plan.featured && (
                  <div className="inline-block bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full mb-4">
                    COMING SOON
                  </div>
                )}
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <p className="text-muted-foreground mt-2">{plan.description}</p>
                <div className="text-4xl font-bold mt-6">
                  {plan.price}
                  {plan.period && <span className="text-lg text-muted-foreground">{plan.period}</span>}
                </div>
                <Button
                  className="w-full mt-6 bg-primary hover:bg-primary/90"
                  disabled={plan.comingSoon}
                  variant={plan.featured && plan.comingSoon ? 'default' : plan.comingSoon ? 'outline' : 'default'}
                >
                  {plan.cta}
                </Button>
                <ul className="space-y-4 mt-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section className="bg-muted/30 py-16 px-4 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Get Early Access to Premium</h2>
          <p className="text-muted-foreground mb-8">
            Join our waitlist to be notified when Pro and Enterprise plans launch.
          </p>
          <NewsletterForm variant="waitlist" />
        </div>
      </section>
    </PageLayout>
  )
}
