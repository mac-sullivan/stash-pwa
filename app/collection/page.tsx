import CardCollection from '../components/CardCollection';
import Link from 'next/link';
import ThemeToggle from '../components/ThemeToggle';

export default function CollectionPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              My Stash
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              All your saved business cards.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors duration-200"
              style={{ background: 'var(--accent)' }}
            >
              + Scan Card
            </Link>
          </div>
        </div>

        <CardCollection />
      </div>
    </main>
  );
}
