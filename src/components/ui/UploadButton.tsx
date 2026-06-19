import { useRef, useState } from 'react'
import { Button } from './Button'

interface UploadButtonProps {
  onUpload: (file: File) => Promise<void>
  label?: string
  accept?: string
  variant?: 'primary' | 'outline'
  size?: 'sm' | 'md'
}

/** File picker that uploads each selected file via onUpload, with a busy state. */
export function UploadButton({ onUpload, label = 'Upload', accept, variant = 'primary', size = 'sm' }: UploadButtonProps) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setBusy(true)
    try { for (const f of files) await onUpload(f) }
    finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }

  return (
    <>
      <input ref={ref} type="file" accept={accept} multiple onChange={handleFiles} style={{ display: 'none' }} />
      <Button variant={variant} size={size} loading={busy} onClick={() => ref.current?.click()}>
        {!busy && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><path d="M12 5v12" /></svg>}
        {label}
      </Button>
    </>
  )
}
