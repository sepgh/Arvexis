import { useState, useEffect, useRef } from 'react'
import { getPreviewStatus, type PreviewJobStatus } from '@/api/preview'

const POLL_INTERVAL_MS = 1000

export function usePreview(initialJob: PreviewJobStatus | null) {
  const [job, setJob]         = useState<PreviewJobStatus | null>(initialJob)
  const [polling, setPolling] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!initialJob) return
    setJob(initialJob)
    if (initialJob.status === 'pending' || initialJob.status === 'running') {
      startPolling(initialJob.jobId)
    }
    return () => stopPolling()
  }, [initialJob?.jobId])

  function startPolling(jobId: string) {
    setPolling(true)
    const poll = async () => {
      try {
        const status = await getPreviewStatus(jobId)
        setJob(status)
        if (status.status === 'pending' || status.status === 'running') {
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
        } else {
          setPolling(false) // done | failed | cancelled
        }
      } catch {
        setPolling(false)
      }
    }
    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPolling(false)
  }

  return { job, polling }
}
