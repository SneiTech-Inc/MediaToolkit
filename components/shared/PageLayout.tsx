import { Header } from '@/components/sections/header'
import { Footer } from '@/components/sections/footer'

interface PageLayoutProps {
  children: React.ReactNode
}

/**
 * Standard page shell: sticky Header + content + Footer.
 * Wraps every page in the app to eliminate repeated <main> boilerplate.
 */
export function PageLayout({ children }: PageLayoutProps) {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      {children}
      <Footer />
    </main>
  )
}
