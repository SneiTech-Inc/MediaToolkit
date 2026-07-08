import type { Tool } from '@/types/tool'

export const documentTools = [
  {
    id: 'word-to-pdf', slug: 'word-to-pdf', name: 'Word to PDF', category: 'document',
    description: 'Convert Word documents to PDF', icon: '📄', badge: null,
    dateAdded: '2024-01-13', inputFormats: ['doc', 'docx'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'pdf-to-word', slug: 'pdf-to-word', name: 'PDF to Word', category: 'document',
    description: 'Convert PDF to editable Word documents', icon: '📋', badge: null,
    dateAdded: '2024-01-13', inputFormats: ['pdf'], outputFormats: ['docx'], isComingSoon: false,
  },
  {
    id: 'excel-to-pdf', slug: 'excel-to-pdf', name: 'Excel to PDF', category: 'document',
    description: 'Convert Excel spreadsheets to PDF', icon: '📊', badge: null,
    dateAdded: '2024-01-13', inputFormats: ['xls', 'xlsx'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'pdf-to-excel', slug: 'pdf-to-excel', name: 'PDF to Excel', category: 'document',
    description: 'Convert PDF tables to Excel spreadsheets', icon: '📈', badge: null,
    dateAdded: '2024-01-14', inputFormats: ['pdf'], outputFormats: ['xlsx'], isComingSoon: false,
  },
  {
    id: 'ppt-to-pdf', slug: 'ppt-to-pdf', name: 'PowerPoint to PDF', category: 'document',
    description: 'Convert presentations to PDF', icon: '🎪', badge: null,
    dateAdded: '2024-01-14', inputFormats: ['ppt', 'pptx'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'pdf-to-ppt', slug: 'pdf-to-ppt', name: 'PDF to PowerPoint', category: 'document',
    description: 'Convert PDF to editable presentations', icon: '🎨', badge: null,
    dateAdded: '2024-01-14', inputFormats: ['pdf'], outputFormats: ['pptx'], isComingSoon: false,
  },
  {
    id: 'text-to-pdf', slug: 'text-to-pdf', name: 'Text to PDF', category: 'document',
    description: 'Convert text files to PDF documents', icon: '📝', badge: null,
    dateAdded: '2024-01-15', inputFormats: ['txt'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'html-to-pdf', slug: 'html-to-pdf', name: 'HTML to PDF', category: 'document',
    description: 'Convert HTML pages to PDF documents', icon: '🌐', badge: null,
    dateAdded: '2024-01-15', inputFormats: ['html'], outputFormats: ['pdf'], isComingSoon: true,
  },
  {
    id: 'markdown-to-pdf', slug: 'markdown-to-pdf', name: 'Markdown to PDF', category: 'document',
    description: 'Convert Markdown files to PDF', icon: '⌨️', badge: null,
    dateAdded: '2024-01-15', inputFormats: ['md'], outputFormats: ['pdf'], isComingSoon: true,
  },
  {
    id: 'csv-to-pdf', slug: 'csv-to-pdf', name: 'CSV to PDF', category: 'document',
    description: 'Convert CSV files to PDF tables', icon: '📊', badge: null,
    dateAdded: '2024-01-16', inputFormats: ['csv'], outputFormats: ['pdf'], isComingSoon: true,
  },
] as const satisfies Tool[]
