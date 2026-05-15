import { useState } from 'react'
import { Shell } from './components/Shell'
import { DataProvider } from './context/DataContext'
import { firstNavKeyInGroup, type NavKey } from './navConfig'
import { DashboardPanels } from './views/DashboardPanels'

export default function App() {
  const [nav, setNav] = useState<NavKey>('home')

  return (
    <DataProvider>
      <div className="h-full min-h-0">
        <Shell
          active={nav}
          onNav={setNav}
          onSelectCategory={(groupId) => setNav(firstNavKeyInGroup(groupId))}
        >
          <DashboardPanels active={nav} onNavigate={setNav} />
        </Shell>
      </div>
    </DataProvider>
  )
}
