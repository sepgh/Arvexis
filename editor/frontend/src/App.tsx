import { useEffect } from 'react'
import RootLayout from '@/components/layout/RootLayout'
import CanvasPage from '@/pages/CanvasPage'
import WelcomePage from '@/pages/WelcomePage'
import { useEditorStore } from '@/store'
import { getProjectStatus, getProjectConfig } from '@/api/project'

export default function App() {
  const { isProjectOpen, appLoading, setProjectConfig, setAppLoading } = useEditorStore()

  useEffect(() => {
    getProjectStatus()
      .then(async (status) => {
        if (status.open) {
          const config = await getProjectConfig()
          setProjectConfig(config)
        }
      })
      .catch(() => {
        /* backend not reachable — stay on welcome page */
      })
      .finally(() => {
        setAppLoading(false)
      })
  }, [])

  if (appLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <RootLayout>
      {isProjectOpen ? <CanvasPage /> : <WelcomePage />}
    </RootLayout>
  )
}
