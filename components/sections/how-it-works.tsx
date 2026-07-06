import { SectionHeader } from '@/components/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { HOW_IT_WORKS } from '@/lib/constants'
import { ArrowRight } from 'lucide-react'

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50/50 dark:from-blue-950/20 via-background to-background">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          title="Simple 3-Step Process"
          description="Download videos faster than ever with our intuitive interface"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {HOW_IT_WORKS.map((item, index) => (
            <div key={index} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold mb-6 shadow-lg hover:scale-110 transition-transform duration-300">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
              </div>

              {index < HOW_IT_WORKS.length - 1 && (
                <div className="hidden md:flex absolute -right-4 top-20 transform translate-x-full">
                  <ArrowRight className="w-8 h-8 text-primary/30" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="md:hidden space-y-6 max-w-sm mx-auto">
          {HOW_IT_WORKS.map((item, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg mb-2">
                  {item.step}
                </div>
                {index < HOW_IT_WORKS.length - 1 && <div className="w-1 h-12 bg-primary/20 mt-2" />}
              </div>
              <div className="pt-2 pb-4">
                <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">That&apos;s all it takes to download your videos!</p>
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-3 rounded-lg font-semibold">
            Start Now - It&apos;s Free
          </Button>
        </div>
      </div>
    </section>
  )
}
