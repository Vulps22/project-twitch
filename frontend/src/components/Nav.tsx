export type Page = 'dashboard' | 'events' | 'log' | 'settings';

const PAGES: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'events',    label: 'Events' },
  { id: 'log',       label: 'Log' },
  { id: 'settings',  label: 'Settings' },
];

interface NavProps {
  active: Page;
  onNavigate: (page: Page) => void;
}

export default function Nav({ active, onNavigate }: NavProps) {
  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      display: 'flex',
      gap: 4,
      flexShrink: 0,
    }}>
      {PAGES.map(({ id, label }) => (
        <a
          key={id}
          href="#"
          onClick={(e) => { e.preventDefault(); onNavigate(id); }}
          style={{
            color: active === id ? 'var(--accent)' : 'var(--muted)',
            textDecoration: 'none',
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 500,
            borderBottom: `2px solid ${active === id ? 'var(--accent)' : 'transparent'}`,
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
