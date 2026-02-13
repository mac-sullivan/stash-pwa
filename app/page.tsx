import CardScanner from './components/CardScanner';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-1">Stash</h1>
            <p className="text-gray-600">Your personal collection of cool businesses and contacts.</p>
          </div>
          <Link
            href="/collection"
            className="px-4 py-2 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900"
          >
            My Stash
          </Link>
        </div>

        <CardScanner />
      </div>
    </main>
  );
}