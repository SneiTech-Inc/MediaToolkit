'use client'

import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ResultCard } from '@/components/shared/ResultCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { RelatedTools } from '@/components/shared/RelatedTools'
import { EmptyState } from '@/components/shared/EmptyState'
import { ToolOptions } from '@/components/shared/ToolOptions'
import { TOOLS } from '@/lib/constants'
import { useState } from 'react'

export default function ToolPage({ params }: { params: { category: string; tool: string } }) {
  const toolData = TOOLS.find(t => t.slug === params.tool)

  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  if (!toolData) {
    return (
      <PageLayout>
        <EmptyState
          title="Tool not found"
          message="The tool you're looking for doesn't exist."
          action={{ label: 'Back to Home', href: '/' }}
        />
      </PageLayout>
    )
  }

  const handleFileSelect = (file: File) => {
    setUploadedFile(file)
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      setIsComplete(true)
    }, 2000)
  }

  const handleReset = () => {
    setUploadedFile(null)
    setIsProcessing(false)
    setIsComplete(false)
  }

  const relatedTools = TOOLS.filter(
    t => t.category === toolData.category && t.slug !== toolData.slug
  ).slice(0, 4)

  const toolFaqs = [
    {
      question: 'Is my file secure?',
      answer: 'Yes! All processing happens entirely in your browser. Your files never leave your device.',
    },
    {
      question: 'What formats are supported?',
      answer: `Input: ${toolData.inputFormats?.map(f => f.toUpperCase()).join(', ') || 'N/A'}\nOutput: ${toolData.outputFormats?.map(f => f.toUpperCase()).join(', ') || 'N/A'}`,
    },
    {
      question: 'Is there a file size limit?',
      answer: "File sizes are limited by your browser's available memory. Most modern browsers can handle files up to several GB.",
    },
  ]

  return (
    <PageLayout>
      <PageHero
        icon={toolData.icon}
        title={toolData.name}
        description={toolData.description}
        backHref={`/tools/${params.category}`}
        backLabel={params.category}
      />

      {/* Main Content */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2">
            {!uploadedFile ? (
              <UploadDropzone
                acceptedFormats={toolData.inputFormats}
                onFileSelect={handleFileSelect}
              />
            ) : isProcessing ? (
              <ProcessingStatus />
            ) : isComplete ? (
              <ResultCard
                fileName={uploadedFile.name}
                onDownload={() => {}}
                onReset={handleReset}
              />
            ) : null}

            {/* How To Use */}
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6">How to {toolData.name}</h2>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    1
                  </span>
                  <div>
                    <h4 className="font-semibold">Upload your file</h4>
                    <p className="text-muted-foreground">Click the upload area above to select your file</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    2
                  </span>
                  <div>
                    <h4 className="font-semibold">Configure options</h4>
                    <p className="text-muted-foreground">Choose your preferred settings on the right panel</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    3
                  </span>
                  <div>
                    <h4 className="font-semibold">Download your file</h4>
                    <p className="text-muted-foreground">After processing, download your converted file instantly</p>
                  </div>
                </li>
              </ol>
            </div>

            {/* FAQ */}
            <div className="mt-12">
              <FAQSection
                faqs={toolFaqs}
                title="Frequently Asked Questions"
                description=""
              />
            </div>
          </div>

          {/* Right Column - Options Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <ToolOptions
                outputFormats={toolData.outputFormats}
                disabled={!uploadedFile}
              />

              <div className="mt-8">
                <RelatedTools tools={relatedTools} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
