import { useEffect, useState } from 'react'
import { getHealth } from '@/api/health'

export function useHealth() {
  const [status, setStatus] = useState<'unknown' | 'ok' | 'error'>('unknown')

  useEffect(() => {
    getHealth()
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'))
  }, [])

  return status
}
