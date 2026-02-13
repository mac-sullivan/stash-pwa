'use client';

import { useTheme } from './ThemeProvider';

const themes = [
  { key: 'light' as const, label: 'Light' },
  { key: 'dark' as const, label: 'Dark' },
  { key: 'bold' as const, label: 'Bold' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {themes.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          className="px-3 py-1.5 text-xs font-semibold transition-all duration-200"
          style={{
            background: theme === key ? 'var(--accent)' : 'var(--bg-card)',
            color: theme === key ? '#ffffff' : 'var(--text-muted)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
