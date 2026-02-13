import CardScanner from './components/CardScanner';
import Link from 'next/link';
import ThemeToggle from './components/ThemeToggle';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
              Stash
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Your personal collection of cool businesses and contacts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/collection"
              className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors duration-200"
              style={{ background: 'var(--accent)' }}
            >
              My Stash
            </Link>
          </div>
        </div>

        <CardScanner />
      </div>
    </main>
  );
}
