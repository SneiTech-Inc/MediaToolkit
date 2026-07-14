'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ResultCard } from '@/components/shared/ResultCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { RelatedTools } from '@/components/shared/RelatedTools'
import { ToolOptions } from '@/components/shared/ToolOptions'
import { TOOLS } from '@/lib/constants'
import type { Tool } from '@/types/tool'

// ─── Tool Registry ───────────────────────────────────────────────────────────
// Map tool slugs to their real implementation components.
// Components are dynamically imported (code-split per tool).
// Add new real tools here as they are implemented.
// ─────────────────────────────────────────────────────────────────────────────

const ImageCompressor = dynamic(
  () => import('@/features/image/components/ImageCompressor').then(m => ({ default: m.ImageCompressor })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ImageResizer = dynamic(
  () => import('@/features/image/components/ImageResizer').then(m => ({ default: m.ImageResizer })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ImageConverter = dynamic(
  () => import('@/features/image/components/ImageConverter').then(m => ({ default: m.ImageConverter })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ImageCrop = dynamic(
  () => import('@/features/image/components/ImageCrop').then(m => ({ default: m.ImageCrop })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ImageRotate = dynamic(
  () => import('@/features/image/components/ImageRotate').then(m => ({ default: m.ImageRotate })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ImageFlip = dynamic(
  () => import('@/features/image/components/ImageFlip').then(m => ({ default: m.ImageFlip })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const WatermarkImage = dynamic(
  () => import('@/features/image/components/WatermarkImage').then(m => ({ default: m.WatermarkImage })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ImageBlur = dynamic(
  () => import('@/features/image/components/ImageBlur').then(m => ({ default: m.ImageBlur })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ImageToPDF = dynamic(
  () => import('@/features/image/components/ImageToPDF').then(m => ({ default: m.ImageToPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const AddBorder = dynamic(
  () => import('@/features/image/components/AddBorder').then(m => ({ default: m.AddBorder })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const MergePDF = dynamic(
  () => import('@/features/pdf/components/MergePDF').then(m => ({ default: m.MergePDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const SplitPDF = dynamic(
  () => import('@/features/pdf/components/SplitPDF').then(m => ({ default: m.SplitPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const CompressPDF = dynamic(
  () => import('@/features/pdf/components/CompressPDF').then(m => ({ default: m.CompressPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const PDFToJPG = dynamic(
  () => import('@/features/pdf/components/PDFToJPG').then(m => ({ default: m.PDFToJPG })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const JPGToPDF = dynamic(
  () => import('@/features/pdf/components/JPGToPDF').then(m => ({ default: m.JPGToPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const RotatePDF = dynamic(
  () => import('@/features/pdf/components/RotatePDF').then(m => ({ default: m.RotatePDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const WatermarkPDF = dynamic(
  () => import('@/features/pdf/components/WatermarkPDF').then(m => ({ default: m.WatermarkPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const OrganizePDF = dynamic(
  () => import('@/features/pdf/components/OrganizePDF').then(m => ({ default: m.OrganizePDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ProtectPDF = dynamic(
  () => import('@/features/pdf/components/ProtectPDF').then(m => ({ default: m.ProtectPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const UnlockPDF = dynamic(
  () => import('@/features/pdf/components/UnlockPDF').then(m => ({ default: m.UnlockPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const CropPDF = dynamic(
  () => import('@/features/pdf/components/CropPDF').then(m => ({ default: m.CropPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const OCRPDF = dynamic(
  () => import('@/features/pdf/components/OCRPDF').then(m => ({ default: m.OCRPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const RepairPDF = dynamic(
  () => import('@/features/pdf/components/RepairPDF').then(m => ({ default: m.RepairPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const SignPDF = dynamic(
  () => import('@/features/pdf/components/SignPDF').then(m => ({ default: m.SignPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ScanToPDF = dynamic(
  () => import('@/features/pdf/components/ScanToPDF').then(m => ({ default: m.ScanToPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const PDFToMarkdown = dynamic(
  () => import('@/features/pdf/components/PDFToMarkdown').then(m => ({ default: m.PDFToMarkdown })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const WordToPDF = dynamic(
  () => import('@/features/document/components/WordToPDF').then(m => ({ default: m.WordToPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const PDFToWord = dynamic(
  () => import('@/features/document/components/PDFToWord').then(m => ({ default: m.PDFToWord })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const PDFToExcel = dynamic(
  () => import('@/features/document/components/PDFToExcel').then(m => ({ default: m.PDFToExcel })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ExcelToPDF = dynamic(
  () => import('@/features/document/components/ExcelToPDF').then(m => ({ default: m.ExcelToPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const PPTToPDF = dynamic(
  () => import('@/features/document/components/PPTToPDF').then(m => ({ default: m.PPTToPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const PDFToPPT = dynamic(
  () => import('@/features/document/components/PDFToPPT').then(m => ({ default: m.PDFToPPT })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const TextToPDF = dynamic(
  () => import('@/features/document/components/TextToPDF').then(m => ({ default: m.TextToPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const HTMLToPDF = dynamic(
  () => import('@/features/document/components/HTMLToPDF').then(m => ({ default: m.HTMLToPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const MarkdownToPDF = dynamic(
  () => import('@/features/document/components/MarkdownToPDF').then(m => ({ default: m.MarkdownToPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const CSVToPDF = dynamic(
  () => import('@/features/document/components/CSVToPDF').then(m => ({ default: m.CSVToPDF })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const WordCounter = dynamic(
  () => import('@/features/text/components/WordCounter').then(m => ({ default: m.WordCounter })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const CaseConverter = dynamic(
  () => import('@/features/text/components/CaseConverter').then(m => ({ default: m.CaseConverter })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const RemoveDuplicates = dynamic(
  () => import('@/features/text/components/RemoveDuplicates').then(m => ({ default: m.RemoveDuplicates })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const SortLines = dynamic(
  () => import('@/features/text/components/SortLines').then(m => ({ default: m.SortLines })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const JSONFormatter = dynamic(
  () => import('@/features/text/components/JSONFormatter').then(m => ({ default: m.JSONFormatter })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const Base64Encoder = dynamic(
  () => import('@/features/text/components/Base64Encoder').then(m => ({ default: m.Base64Encoder })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const UrlEncoder = dynamic(
  () => import('@/features/text/components/UrlEncoder').then(m => ({ default: m.UrlEncoder })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const PasswordGenerator = dynamic(
  () => import('@/features/text/components/PasswordGenerator').then(m => ({ default: m.PasswordGenerator })),
  { ssr: false, loading: () => <ToolLoading /> }
)


const ConvertAudio = dynamic(
  () => import('@/features/audio/components/ConvertAudio').then(m => ({ default: m.ConvertAudio })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const MergeAudio = dynamic(
  () => import('@/features/audio/components/MergeAudio').then(m => ({ default: m.MergeAudio })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const TrimAudio = dynamic(
  () => import('@/features/audio/components/TrimAudio').then(m => ({ default: m.TrimAudio })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ChangeVolume = dynamic(
  () => import('@/features/audio/components/ChangeVolume').then(m => ({ default: m.ChangeVolume })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const CompressVideo = dynamic(
  () => import('@/features/video/components/CompressVideo').then(m => ({ default: m.CompressVideo })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ConvertVideo = dynamic(
  () => import('@/features/video/components/ConvertVideo').then(m => ({ default: m.ConvertVideo })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const TrimVideo = dynamic(
  () => import('@/features/video/components/TrimVideo').then(m => ({ default: m.TrimVideo })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const MergeVideo = dynamic(
  () => import('@/features/video/components/MergeVideo').then(m => ({ default: m.MergeVideo })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const CropVideo = dynamic(
  () => import('@/features/video/components/CropVideo').then(m => ({ default: m.CropVideo })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const RotateVideo = dynamic(
  () => import('@/features/video/components/RotateVideo').then(m => ({ default: m.RotateVideo })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const QRCodeGenerator = dynamic(
  () => import('@/features/utility/components/QRCodeGenerator').then(m => ({ default: m.QRCodeGenerator })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const ColorPicker = dynamic(
  () => import('@/features/utility/components/ColorPicker').then(m => ({ default: m.ColorPicker })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const TimestampConverter = dynamic(
  () => import('@/features/utility/components/TimestampConverter').then(m => ({ default: m.TimestampConverter })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const UUIDGenerator = dynamic(
  () => import('@/features/utility/components/UUIDGenerator').then(m => ({ default: m.UUIDGenerator })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const HashGenerator = dynamic(
  () => import('@/features/utility/components/HashGenerator').then(m => ({ default: m.HashGenerator })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const LoremIpsumGenerator = dynamic(
  () => import('@/features/utility/components/LoremIpsumGenerator').then(m => ({ default: m.LoremIpsumGenerator })),
  { ssr: false, loading: () => <ToolLoading /> }
)

const toolComponents: Record<string, React.ComponentType> = {
  'compress-image': ImageCompressor,
  'resize-image': ImageResizer,
  'convert-image': ImageConverter,
  'crop-image': ImageCrop,
  'rotate-image': ImageRotate,
  'flip-image': ImageFlip,
  'watermark-image': WatermarkImage,
  'blur-image': ImageBlur,
  'image-to-pdf': ImageToPDF,
  'add-border': AddBorder,
  'merge-pdf': MergePDF,
  'split-pdf': SplitPDF,
  'compress-pdf': CompressPDF,
  'convert-audio': ConvertAudio,
  'merge-audio': MergeAudio,
  'trim-audio': TrimAudio,
  'change-volume': ChangeVolume,
  'compress-video': CompressVideo,
  'convert-video': ConvertVideo,
  'trim-video': TrimVideo,
  'merge-video': MergeVideo,
  'crop-video': CropVideo,
  'rotate-video': RotateVideo,
  'pdf-to-jpg': PDFToJPG,
  'jpg-to-pdf': JPGToPDF,
  'rotate-pdf': RotatePDF,
  'watermark-pdf': WatermarkPDF,
  'organize-pdf': OrganizePDF,
  'protect-pdf': ProtectPDF,
  'unlock-pdf': UnlockPDF,
  'crop-pdf': CropPDF,
  'ocr-pdf': OCRPDF,
  'repair-pdf': RepairPDF,
  'sign-pdf': SignPDF,
  'scan-to-pdf': ScanToPDF,
  'pdf-to-markdown': PDFToMarkdown,
  'base64-encoder': Base64Encoder,
  'case-converter': CaseConverter,
  'json-formatter': JSONFormatter,
  'password-generator': PasswordGenerator,
  'remove-duplicates': RemoveDuplicates,
  'sort-lines': SortLines,
  'url-encoder': UrlEncoder,
  'word-counter': WordCounter,
  'word-to-pdf': WordToPDF,
  'pdf-to-word': PDFToWord,
  'pdf-to-excel': PDFToExcel,
  'excel-to-pdf': ExcelToPDF,
  'ppt-to-pdf': PPTToPDF,
  'pdf-to-ppt': PDFToPPT,
  'text-to-pdf': TextToPDF,
  'html-to-pdf': HTMLToPDF,
  'markdown-to-pdf': MarkdownToPDF,
  'csv-to-pdf': CSVToPDF,
  'qr-generator': QRCodeGenerator,
  'color-picker': ColorPicker,
  'timestamp-converter': TimestampConverter,
  'uuid-generator': UUIDGenerator,
  'hash-generator': HashGenerator,
  'lorem-ipsum-generator': LoremIpsumGenerator,
}

// ─── Generic Fallback (placeholder for tools without real logic yet) ─────────

interface ToolPageClientProps {
  toolSlug: string
  toolData: Tool
}

export function ToolPageClient({ toolSlug, toolData }: ToolPageClientProps) {
  // Check if this tool has a real implementation
  const RealTool = toolComponents[toolSlug]

  if (RealTool) {
    return <RealTool />
  }

  // ─── Generic fallback UI for unimplemented tools ───────────────────────
  return <GenericToolFallback toolData={toolData} />
}

function GenericToolFallback({ toolData }: { toolData: Tool }) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

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
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
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

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to {toolData.name}</h2>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">1</span>
                <div>
                  <h4 className="font-semibold">Upload your file</h4>
                  <p className="text-muted-foreground">Click the upload area above to select your file</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">2</span>
                <div>
                  <h4 className="font-semibold">Configure options</h4>
                  <p className="text-muted-foreground">Choose your preferred settings on the right panel</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">3</span>
                <div>
                  <h4 className="font-semibold">Download your file</h4>
                  <p className="text-muted-foreground">After processing, download your converted file instantly</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="mt-12">
            <FAQSection faqs={toolFaqs} title="Frequently Asked Questions" description="" />
          </div>
        </div>

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
  )
}

/** Skeleton shown while a real tool component is being lazy-loaded. */
function ToolLoading() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-64 bg-muted rounded-xl" />
          <div className="h-8 bg-muted rounded-lg w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
    </section>
  )
}
