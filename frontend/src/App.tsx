import { useState } from 'react';
import './index.css';
import Header from './components/Header.tsx';
import Nav, { type Page } from './components/Nav.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import EventsPage from './pages/EventsPage.tsx';
import LogPage from './pages/LogPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';

const PAGES: Record<Page, JSX.Element> = {
  dashboard: <DashboardPage />,
  events:    <EventsPage />,
  log:       <LogPage />,
  settings:  <SettingsPage />,
};

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <Nav active={page} onNavigate={setPage} />
      <main style={{ padding: 24, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {PAGES[page]}
      </main>
    </div>
  );
}
