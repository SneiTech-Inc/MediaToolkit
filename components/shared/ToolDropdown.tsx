import Link from 'next/link'
import {
  ChevronDown, type LucideIcon,
  Merge, Scissors, FileDown, RotateCw, Image, FileImage,
  Lock, Unlock, Droplets, Crop, FileText, Hash, Sparkles,
  WrapText, ArrowLeftRight, QrCode, Palette,
  Fingerprint, GripHorizontal, FileArchive,
  FileSpreadsheet, Presentation, Globe, Code, Table,
} from 'lucide-react'
import type { Tool } from '@/types/tool'

/** Map tool slug → Lucide icon for the dropdown menu. */
const ICON_MAP: Record<string, LucideIcon> = {
  'merge-pdf': Merge, 'split-pdf': Scissors, 'compress-pdf': FileDown,
  'rotate-pdf': RotateCw, 'crop-pdf': Crop, 'watermark-pdf': Droplets,
  'protect-pdf': Lock, 'unlock-pdf': Unlock, 'organize-pdf': GripHorizontal,
  'pdf-to-jpg': FileImage, 'jpg-to-pdf': Image,
  'pdf-page-numbers': Hash,
  'ocr-pdf': FileText, 'repair-pdf': FileText,
  'sign-pdf': FileText, 'scan-to-pdf': FileText,
  'pdf-to-markdown': FileText,

  'compress-image': FileDown, 'resize-image': Crop, 'convert-image': ArrowLeftRight,
  'crop-image': Crop, 'rotate-image': RotateCw, 'flip-image': WrapText,
  'watermark-image': Droplets, 'blur-image': Droplets,
  'image-to-pdf': FileText, 'add-border': Crop,
  'remove-background': Sparkles,

  'compress-video': FileDown, 'convert-video': ArrowLeftRight,
  'trim-video': Scissors, 'merge-video': Merge,
  'crop-video': Crop, 'rotate-video': RotateCw,
  'resize-video': FileDown, 'video-speed': FileText,
  'reverse-video': ArrowLeftRight, 'extract-audio': FileText,
  'video-to-gif': Image,

  'convert-audio': ArrowLeftRight, 'merge-audio': Merge, 'trim-audio': Scissors,
  'change-volume': FileText,

  'word-counter': FileText, 'case-converter': FileText,
  'json-formatter': FileText, 'base64-encoder': Lock,
  'remove-duplicates': FileText, 'sort-lines': FileText,
  'url-encoder': Globe, 'password-generator': Lock,

  'qr-generator': QrCode, 'color-picker': Palette, 'hash-generator': Fingerprint,
  'uuid-generator': Fingerprint, 'timestamp-converter': FileText,

  // Document tools
  'word-to-pdf': FileText, 'pdf-to-word': FileText, 'excel-to-pdf': FileSpreadsheet,
  'pdf-to-excel': FileSpreadsheet, 'ppt-to-pdf': Presentation, 'pdf-to-ppt': Presentation,
  'text-to-pdf': FileText, 'html-to-pdf': Globe, 'markdown-to-pdf': Code, 'csv-to-pdf': Table,
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  pdf: FileText, image: Image, video: FileArchive, audio: FileArchive,
  document: FileText, text: FileText, utility: Palette,
}

interface ToolDropdownProps {
  label: string
  category: string
  tools: readonly Tool[]
}

/**
 * Polished dropdown menu for tool category navigation.
 * 2-column grid with Lucide icons, section header, hover states, View All footer.
 * Uses CSS group-hover — no JavaScript state, no extra deps.
 */
export function ToolDropdown({ label, category, tools }: ToolDropdownProps) {
  const CategoryIcon = CATEGORY_ICONS[category]
  const allComingSoon = tools.every(t => t.isComingSoon)

  return (
    <div className="relative group before:content-[''] before:absolute before:top-full before:left-0 before:w-full before:h-5">
      {/* Trigger */}
      <button className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors py-2">
        {label}
        <ChevronDown className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
      </button>

      {/* Dropdown panel */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[500px] max-w-[calc(100vw-2rem)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none group-hover:pointer-events-auto">
        <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Section header */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
            {CategoryIcon && <CategoryIcon className="w-4 h-4 text-primary" />}
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">({tools.length} tools)</span>
          </div>

          {/* Tool grid — 2 columns, or "Coming Soon" placeholder */}
          {allComingSoon ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Coming Soon — Tools are on their way.
              </p>
            </div>
          ) : (
            <div className="p-3 max-h-[420px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-1">
                {tools.map((tool) => {
                  const Icon = ICON_MAP[tool.slug]
                  return (
                    <Link
                      key={tool.id}
                      href={tool.isComingSoon ? '#' : `/tools/${category}/${tool.slug}`}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group/item ${
                        tool.isComingSoon
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-accent/10 hover:text-accent-foreground cursor-pointer'
                      }`}
                      onClick={(e) => tool.isComingSoon && e.preventDefault()}
                      tabIndex={tool.isComingSoon ? -1 : 0}
                    >
                      <span className="shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover/item:bg-primary/10 transition-colors">
                        {Icon ? (
                          <Icon className="w-4 h-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                        ) : (
                          <span className="text-base">{tool.icon}</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground text-sm block truncate group-hover/item:text-primary transition-colors">
                          {tool.name}
                        </span>
                      </div>
                      {tool.isComingSoon && (
                        <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Soon
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* View All footer */}
          <Link
            href={`/tools/${category}`}
            className="flex items-center justify-center gap-2 px-5 py-3 border-t border-border bg-muted/10 hover:bg-muted/30 transition-colors text-sm font-medium text-primary"
          >
            View all {category} tools
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </Link>
        </div>
      </div>
    </div>
  )
}
