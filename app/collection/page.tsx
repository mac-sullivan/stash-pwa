import CardCollection from '../components/CardCollection';
import Link from 'next/link';

export default function CollectionPage() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">My Stash</h1>
            <p className="text-gray-600">All your saved business cards.</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            + Scan Card
          </Link>
        </div>

        <CardCollection />
      </div>
    </main>
  );
}
