'use client'

import { useState, useCallback } from 'react'
import { Download, RotateCcw, FileText, Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { protectPDF, checkPasswordStrength } from '@/features/pdf/utils/pdfProtector'
import type { ProtectOptions } from '@/features/pdf/utils/pdfProtector'
import { formatBytes } from '@/utils/formatBytes'
import { getSaveVexFileName } from '@/utils/fileNames'

// ─── Constants ─────────────────────────────────────────────────────────────

interface PermissionPreset {
  label: string
  permissions: ProtectOptions['permissions']
}

const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    label: 'Standard',
    permissions: { printing: true, copying: true, modifying: false, annotating: false, fillingForms: true },
  },
  {
    label: 'Restricted',
    permissions: { printing: true, copying: false, modifying: false, annotating: false, fillingForms: false },
  },
  {
    label: 'Locked',
    permissions: { printing: false, copying: false, modifying: false, annotating: false, fillingForms: false },
  },
]

const TOOL_FAQS = [
  { question: 'What encryption is used?', answer: 'SaveVex uses AES-256-CBC encryption with PBKDF2 key derivation (100,000 iterations, SHA-256). This is industry-standard encryption for protecting sensitive documents.' },
  { question: 'What is the difference between User and Owner password?', answer: 'The User password is required to open and view the PDF. The Owner password is for future use — it will allow controlling permissions like printing, copying, and editing.' },
  { question: 'Can I remove the password later?', answer: 'Yes! Use the Unlock PDF tool (coming soon) to remove password protection from an encrypted PDF.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All encryption happens entirely in your browser using the Web Crypto API. Your PDF and password never leave your device.' },
]

// ─── Component ─────────────────────────────────────────────────────────────

export function ProtectPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [userPassword, setUserPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [showUserPw, setShowUserPw] = useState(false)
  const [showOwnerPw, setShowOwnerPw] = useState(false)
  const [permissions, setPermissions] = useState<ProtectOptions['permissions']>({
    printing: true,
    copying: true,
    modifying: false,
    annotating: false,
    fillingForms: true,
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [encryptedData, setEncryptedData] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Upload ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f)
    setError(null)
    setEncryptedData(null)
    try {
      const count = await getPdfPageCount(f)
      setPageCount(count)
    } catch {
      setError('Failed to read PDF.')
    }
  }, [])

  // ── Permission helpers ──────────────────────────────────────────────

  const togglePermission = (key: keyof ProtectOptions['permissions']) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))
    setEncryptedData(null)
  }

  const applyPreset = (preset: PermissionPreset) => {
    setPermissions({ ...preset.permissions })
    setEncryptedData(null)
  }

  // ── Protect ─────────────────────────────────────────────────────────

  const handleProtect = useCallback(async () => {
    if (!file || !userPassword) return
    setIsProcessing(true)
    setError(null)

    try {
      const result = await protectPDF(file, {
        userPassword,
        ownerPassword: ownerPassword || undefined,
        permissions,
      })
      setEncryptedData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encryption failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [file, userPassword, ownerPassword, permissions])

  const handleDownload = useCallback(() => {
    if (!encryptedData || !file) return
    const blob = new Blob([encryptedData], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(file.name.replace('.pdf', '.svpx'))
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [encryptedData, file])

  const handleReset = useCallback(() => {
    setFile(null)
    setPageCount(0)
    setUserPassword('')
    setOwnerPassword('')
    setShowUserPw(false)
    setShowOwnerPw(false)
    setPermissions({ printing: true, copying: true, modifying: false, annotating: false, fillingForms: true })
    setEncryptedData(null)
    setError(null)
  }, [])

  // ── Strength ────────────────────────────────────────────────────────

  const userStrength = userPassword ? checkPasswordStrength(userPassword) : null
  const ownerStrength = ownerPassword ? checkPasswordStrength(ownerPassword) : null

  const allowedCount = Object.values(permissions).filter(Boolean).length
  const deniedCount = Object.values(permissions).length - allowedCount

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Protection Failed" message={error} onRetry={handleProtect} />}

          {!file ? (
            <UploadDropzone acceptedFormats={['pdf']} onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-6">
              {/* File info */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                <FileText className="w-10 h-10 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {pageCount} page{pageCount !== 1 ? 's' : ''} · {formatBytes(file.size)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-1" />New
                </Button>
              </div>

              {/* User Password */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <label className="text-sm font-medium">
                  User Password <span className="text-destructive">*</span>
                </label>
                <div className="relative max-w-md">
                  <input
                    type={showUserPw ? 'text' : 'password'}
                    value={userPassword}
                    onChange={(e) => { setUserPassword(e.target.value); setEncryptedData(null) }}
                    placeholder="Required to open the PDF"
                    className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background text-sm"
                    disabled={isProcessing}
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPw(!showUserPw)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showUserPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {userStrength && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 max-w-[200px] h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          userStrength.label === 'Strong' ? 'bg-green-500' :
                          userStrength.label === 'Medium' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(userStrength.score / 6) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold ${userStrength.color}`}>
                      {userStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Owner Password */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <label className="text-sm font-medium">Owner Password <span className="text-muted-foreground">(optional)</span></label>
                <div className="relative max-w-md">
                  <input
                    type={showOwnerPw ? 'text' : 'password'}
                    value={ownerPassword}
                    onChange={(e) => { setOwnerPassword(e.target.value); setEncryptedData(null) }}
                    placeholder="Controls permissions (editing, copying, etc.)"
                    className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background text-sm"
                    disabled={isProcessing}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOwnerPw(!showOwnerPw)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showOwnerPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {ownerStrength && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 max-w-[200px] h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          ownerStrength.label === 'Strong' ? 'bg-green-500' :
                          ownerStrength.label === 'Medium' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(ownerStrength.score / 6) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold ${ownerStrength.color}`}>{ownerStrength.label}</span>
                  </div>
                )}
              </div>

              {/* Permissions */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <label className="text-sm font-medium">Permissions</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'printing' as const, label: 'Allow Printing' },
                    { key: 'copying' as const, label: 'Allow Copying' },
                    { key: 'modifying' as const, label: 'Allow Editing' },
                    { key: 'annotating' as const, label: 'Allow Annotation' },
                    { key: 'fillingForms' as const, label: 'Allow Form Filling' },
                  ]).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[key]}
                        onChange={() => togglePermission(key)}
                        className="accent-primary"
                        disabled={isProcessing}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>

                {/* Presets */}
                <div className="flex gap-2 pt-2">
                  {PERMISSION_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(preset)}
                      disabled={isProcessing}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Encryption Summary */}
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                <h4 className="text-sm font-semibold">Encryption Summary</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Algorithm</span>
                  <span className="font-medium">AES-256-CBC</span>
                  <span className="text-muted-foreground">Key Derivation</span>
                  <span className="font-medium">PBKDF2 (SHA-256, 100K rounds)</span>
                  <span className="text-muted-foreground">User Password</span>
                  <span className={userPassword ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                    {userPassword ? 'Set' : 'Not set'}
                  </span>
                  <span className="text-muted-foreground">Owner Password</span>
                  <span className={ownerPassword ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                    {ownerPassword ? 'Set' : 'Not set'}
                  </span>
                  <span className="text-muted-foreground">Permissions</span>
                  <span className="font-medium">{allowedCount} allowed, {deniedCount} denied</span>
                </div>
              </div>

              {/* Action */}
              {!encryptedData ? (
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleProtect}
                  disabled={isProcessing || !userPassword}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4 mr-2" />
                  )}
                  {isProcessing ? 'Encrypting...' : 'Protect PDF'}
                </Button>
              ) : (
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Protected PDF ({(encryptedData.length / 1024).toFixed(1)} KB)
                </Button>
              )}

              {isProcessing && <ProcessingStatus message="Encrypting PDF with AES-256..." />}
            </div>
          )}

          {/* How to Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Protect a PDF</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDF', desc: 'Click the upload area to select the PDF you want to protect.' },
                { step: 2, title: 'Set passwords', desc: 'Enter a user password (required to open) and optionally an owner password (for permissions).' },
                { step: 3, title: 'Configure permissions', desc: 'Choose which actions are allowed — printing, copying, editing, annotations, and form filling.' },
                { step: 4, title: 'Encrypt & download', desc: 'Click Protect PDF to encrypt with AES-256, then download your protected file.' },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">{item.step}</span>
                  <div><h4 className="font-semibold">{item.title}</h4><p className="text-muted-foreground text-sm">{item.desc}</p></div>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-12"><FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" /></div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">Protection Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{pageCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">User PW</span><span className={userPassword ? 'text-green-600 font-medium' : ''}>{userPassword ? 'Set' : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Owner PW</span><span className={ownerPassword ? 'text-green-600 font-medium' : ''}>{ownerPassword ? 'Set' : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Permissions</span><span className="font-medium">{allowedCount} of 5</span></div>
                  {encryptedData && (
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">Encrypted size</span>
                      <span className="font-medium text-green-600">{formatBytes(encryptedData.length)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a PDF to protect it with AES-256 encryption. Set a password and configure permissions.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
