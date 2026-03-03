'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getPurchases, calculateDailyNutrition } from '@/lib/db';
import { Purchase, PurchaseItem, NutritionData } from '@/types';

function NutritionCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">
        {value.toLocaleString()}{unit}
      </p>
    </div>
  );
}

function ItemRow({ 
  item, 
  onUpdate 
}: { 
  item: PurchaseItem & { purchaseId?: string };
  onUpdate: (updates: Partial<PurchaseItem>) => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-3">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">{item.name}</h3>
          {item.brand && <p className="text-sm text-gray-500">{item.brand}</p>}
        </div>
        <div className="text-right">
          <span className={`px-2 py-1 rounded text-sm ${item.isFinished ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'}`}>
            {item.isFinished ? 'Finished' : 'Active'}
          </span>
        </div>
      </div>
      
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
          disabled={item.isFinished}
        />
        <div className="flex gap-2 mt-2">
          {[25, 50, 75, 100].map(pct => (
            <button
              key={pct}
              onClick={() => onUpdate({ consumedPercentage: pct })}
              className={`px-3 py-1 text-sm rounded ${item.consumedPercentage === pct ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              disabled={item.isFinished}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>
      
      {item.dateOpened && (
        <p className="text-xs text-gray-400 mt-2">
          Started: {new Date(item.dateOpened).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, loading, logOut } = useAuth();
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [todayNutrition, setTodayNutrition] = useState<NutritionData | null>(null);
  const [activeItems, setActiveItems] = useState<(PurchaseItem & { purchaseId?: string })[]>([]);
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
      
      const today = new Date().toISOString().split('T')[0];
      const allItems = data.flatMap(p => 
        p.items.map(item => ({ ...item, purchaseId: p.id }))
      );
      
      const active = allItems.filter(item => item.dateOpened && !item.isFinished);
      setActiveItems(active);
      
      const nutrition = calculateDailyNutrition(allItems, today);
      setTodayNutrition(nutrition);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setFetching(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">NutriTrack</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.displayName}</span>
            <button
              onClick={logOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-gray-500 text-sm">{today}</p>
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Nutrition</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <NutritionCard label="Calories" value={todayNutrition?.calories || 0} unit="" />
            <NutritionCard label="Protein" value={todayNutrition?.protein || 0} unit="g" />
            <NutritionCard label="Carbs" value={todayNutrition?.carbs || 0} unit="g" />
            <NutritionCard label="Fat" value={todayNutrition?.fat || 0} unit="g" />
            <NutritionCard label="Saturated Fat" value={todayNutrition?.saturatedFat || 0} unit="g" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <NutritionCard label="Cholesterol" value={todayNutrition?.cholesterol || 0} unit="mg" />
            <NutritionCard label="Sodium" value={todayNutrition?.sodium || 0} unit="mg" />
            <NutritionCard label="Fiber" value={todayNutrition?.fiber || 0} unit="g" />
            <NutritionCard label="Sugars" value={todayNutrition?.sugars || 0} unit="g" />
            <NutritionCard label="Added Sugars" value={todayNutrition?.addedSugars || 0} unit="g" />
          </div>
        </section>

        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Items</h2>
            <a
              href="/purchases/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              + Add Purchase
            </a>
          </div>
          
          {activeItems.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 mb-4">No active items yet.</p>
              <a
                href="/purchases/new"
                className="text-blue-600 hover:underline"
              >
                Add your first purchase
              </a>
            </div>
          ) : (
            activeItems.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onUpdate={(updates) => console.log('Update:', item.id, updates)}
              />
            ))
          )}
        </section>

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Quick Links</h2>
          </div>
          <div className="flex gap-4">
            <a
              href="/purchases"
              className="bg-white rounded-lg shadow px-4 py-3 text-gray-700 hover:bg-gray-50"
            >
              View All Purchases
            </a>
            <a
              href="/reports"
              className="bg-white rounded-lg shadow px-4 py-3 text-gray-700 hover:bg-gray-50"
            >
              View Reports
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
