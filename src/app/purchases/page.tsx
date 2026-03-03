'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getPurchases, updatePurchaseItem } from '@/lib/db';
import { Purchase, PurchaseItem } from '@/types';

function ItemCard({ 
  item, 
  purchaseId,
  onStartConsuming,
  onUpdate,
  onFinish
}: { 
  item: PurchaseItem;
  purchaseId: string;
  onStartConsuming: () => void;
  onUpdate: (updates: Partial<PurchaseItem>) => void;
  onFinish: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-medium text-gray-900">{item.name}</h4>
          {item.brand && <p className="text-sm text-gray-500">{item.brand}</p>}
        </div>
        <span className={`px-2 py-1 rounded text-xs ${item.isFinished ? 'bg-gray-200 text-gray-600' : item.dateOpened ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {item.isFinished ? 'Finished' : item.dateOpened ? 'Active' : 'Not started'}
        </span>
      </div>
      
      <p className="text-sm text-gray-500 mt-2">
        {item.servingsPerPackage} servings × {item.nutritionPerServing.calories} cal/serving
      </p>
      
      {!item.dateOpened && !item.isFinished && (
        <button
          onClick={onStartConsuming}
          className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
        >
          Start Consuming
        </button>
      )}
      
      {item.dateOpened && !item.isFinished && (
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Consumed</span>
            <span className="font-medium">{item.consumedPercentage}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={item.consumedPercentage}
            onChange={(e) => onUpdate({ consumedPercentage: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex gap-2 mt-2">
            {[25, 50, 75, 100].map(pct => (
              <button
                key={pct}
                onClick={() => onUpdate({ consumedPercentage: pct })}
                className={`px-3 py-1 text-sm rounded ${item.consumedPercentage === pct ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <button
            onClick={onFinish}
            className="mt-3 bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700"
          >
            Mark as Finished
          </button>
        </div>
      )}
    </div>
  );
}

export default function PurchasesPage() {
  const { user, loading, logOut } = useAuth();
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const data = await getPurchases(user.uid);
      setPurchases(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleStartConsuming = async (purchaseId: string, itemId: string) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    await updatePurchaseItem(user.uid, purchaseId, itemId, { 
      dateOpened: today,
      consumedPercentage: 0 
    });
    fetchData();
  };

  const handleUpdateItem = async (purchaseId: string, itemId: string, updates: Partial<PurchaseItem>) => {
    if (!user) return;
    await updatePurchaseItem(user.uid, purchaseId, itemId, updates);
    fetchData();
  };

  const handleFinish = async (purchaseId: string, itemId: string) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    await updatePurchaseItem(user.uid, purchaseId, itemId, { 
      isFinished: true,
      dateFinished: today
    });
    fetchData();
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">NutriTrack</h1>
          <nav className="flex gap-4">
            <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</a>
            <a href="/purchases/new" className="text-gray-600 hover:text-gray-900">Add Purchase</a>
            <button onClick={logOut} className="text-gray-500 hover:text-gray-700">Sign out</button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Purchases</h2>
          <a
            href="/purchases/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + Add Purchase
          </a>
        </div>

        {purchases.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">No purchases yet.</p>
            <a
              href="/purchases/new"
              className="text-blue-600 hover:underline"
            >
              Add your first purchase
            </a>
          </div>
        ) : (
          purchases.map(purchase => (
            <div key={purchase.id} className="bg-white rounded-lg shadow mb-6">
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {new Date(purchase.date).toLocaleDateString()}
                    </h3>
                    {purchase.store && <p className="text-sm text-gray-500">{purchase.store}</p>}
                  </div>
                  <span className="text-sm text-gray-500">
                    {purchase.items.length} items
                  </span>
                </div>
              </div>
              <div className="p-4">
                {purchase.items.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    purchaseId={purchase.id}
                    onStartConsuming={() => handleStartConsuming(purchase.id, item.id)}
                    onUpdate={(updates) => handleUpdateItem(purchase.id, item.id, updates)}
                    onFinish={() => handleFinish(purchase.id, item.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
