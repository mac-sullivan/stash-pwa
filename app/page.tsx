import CardScanner from './components/CardScanner';

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Stash</h1>
        <p className="text-gray-600 mb-8">Your personal collection of cool businesses and contacts.</p>
        
        <CardScanner />
      </div>
    </main>
  );
}