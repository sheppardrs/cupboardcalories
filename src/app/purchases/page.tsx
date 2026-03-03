'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getPurchases, updatePurchaseItem } from '@/lib/db';
import { Purchase, PurchaseItem } from '@/types';

function PageHeader() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-14">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">NutriTrack</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link href="/purchases" className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md">Purchases</Link>
            <Link href="/purchases/new" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Add</Link>
            <Link href="/reports" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Reports</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

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
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{item.name}</h4>
          {item.brand && <p className="text-sm text-gray-500">{item.brand}</p>}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          item.isFinished 
            ? 'bg-gray-100 text-gray-600' 
            : item.dateOpened 
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
        }`}>
          {item.isFinished ? 'Finished' : item.dateOpened ? 'Active' : 'Not started'}
        </span>
      </div>
      
      <p className="text-sm text-gray-500 mb-3">
        {item.servingsPerPackage} servings × {item.nutritionPerServing.calories} cal/serving
        {item.userPortion && item.userPortion < 100 && (
          <span className="ml-2 text-emerald-600 font-medium">(My portion: {item.userPortion}%)</span>
        )}
      </p>
      
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
          <input
            type="date"
            value={item.dateOpened || ''}
            onChange={(e) => onUpdate({ dateOpened: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Finish Date</label>
          <input
            type="date"
            value={item.dateFinished || ''}
            onChange={(e) => onUpdate({ dateFinished: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={item.isFinished}
          />
        </div>
      </div>
      
      {!item.dateOpened && !item.isFinished && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-500">My Portion</span>
              <span className="font-medium text-gray-700">{item.userPortion || 100}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={item.userPortion || 100}
              onChange={(e) => onUpdate({ userPortion: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
          <button
            onClick={onStartConsuming}
            className="w-full bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            Start Consuming
          </button>
        </div>
      )}
      
      {item.dateOpened && !item.isFinished && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-500">My Portion</span>
              <span className="font-medium text-gray-700">{item.userPortion || 100}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={item.userPortion || 100}
              onChange={(e) => onUpdate({ userPortion: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-500">Consumed</span>
              <span className="font-medium text-gray-700">{item.consumedPercentage}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={item.consumedPercentage}
              onChange={(e) => onUpdate({ consumedPercentage: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex gap-1.5 mt-2">
              {[25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => onUpdate({ consumedPercentage: pct })}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    item.consumedPercentage === pct 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onFinish}
            className="w-full bg-gray-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Mark as Finished
          </button>
        </div>
      )}
    </div>
  );
}

export default function PurchasesPage() {
  const { user, loading } = useAuth();
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Purchases</h2>
          <p className="text-gray-500 text-sm mt-1">{purchases.length} purchase{purchases.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/purchases/new"
          className="inline-flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Purchase
        </Link>
      </div>

      {purchases.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-4">No purchases yet.</p>
          <Link
            href="/purchases/new"
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Add your first purchase →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {purchases.map(purchase => (
            <div key={purchase.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {new Date(purchase.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </h3>
                  {purchase.store && <p className="text-sm text-gray-500">{purchase.store}</p>}
                </div>
                <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200">
                  {purchase.items.length} item{purchase.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
          ))}
        </div>
      )}
      </main>
    </div>
  );
}
