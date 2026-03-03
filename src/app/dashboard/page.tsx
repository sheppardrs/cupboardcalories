'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getPurchases, calculateDailyNutrition, calculatePeriodNutrition } from '@/lib/db';
import { Purchase, PurchaseItem, NutritionData } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const NUTRIENT_OPTIONS = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'saturatedFat', label: 'Saturated Fat', unit: 'g' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugars', label: 'Sugars', unit: 'g' },
  { key: 'addedSugars', label: 'Added Sugars', unit: 'g' },
];

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
          <span className="text-gray-600">My Portion</span>
          <span className="font-medium">{item.userPortion || 100}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={item.userPortion || 100}
          onChange={(e) => onUpdate({ userPortion: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          disabled={item.isFinished}
        />
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
          {item.dateFinished && ` → Finish: ${new Date(item.dateFinished).toLocaleDateString()}`}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, loading, logOut } = useAuth();
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ daily: NutritionData[]; totals: NutritionData; average: NutritionData } | null>(null);
  const [activeItems, setActiveItems] = useState<(PurchaseItem & { purchaseId?: string })[]>([]);
  const [fetching, setFetching] = useState(true);
  const [selectedNutrients, setSelectedNutrients] = useState<string[]>(['calories', 'carbs', 'protein', 'fat', 'saturatedFat']);

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
      
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      
      const allItems = data.flatMap(p => 
        p.items.map(item => ({ ...item, purchaseId: p.id }))
      );
      
      const active = allItems.filter(item => item.dateOpened && !item.isFinished);
      setActiveItems(active);
      
      const weekly = calculatePeriodNutrition(
        allItems,
        weekAgo.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      );
      setWeeklyData(weekly);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setFetching(false);
    }
  };

  const chartData = useMemo(() => {
    if (!weeklyData) return [];
    
    return weeklyData.daily.map((day, index) => {
      const date = new Date();
      date.setDate(date.getDate() - 6 + index);
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        ...day,
      };
    });
  }, [weeklyData]);

  const toggleNutrient = (key: string) => {
    setSelectedNutrients(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
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

  const avg = weeklyData?.average;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
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

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-gray-500 text-sm">{today}</p>
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">This Week&apos;s Daily Average</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <NutritionCard label="Calories" value={avg?.calories || 0} unit="" />
            <NutritionCard label="Protein" value={avg?.protein || 0} unit="g" />
            <NutritionCard label="Carbs" value={avg?.carbs || 0} unit="g" />
            <NutritionCard label="Fat" value={avg?.fat || 0} unit="g" />
            <NutritionCard label="Saturated Fat" value={avg?.saturatedFat || 0} unit="g" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <NutritionCard label="Cholesterol" value={avg?.cholesterol || 0} unit="mg" />
            <NutritionCard label="Sodium" value={avg?.sodium || 0} unit="mg" />
            <NutritionCard label="Fiber" value={avg?.fiber || 0} unit="g" />
            <NutritionCard label="Sugars" value={avg?.sugars || 0} unit="g" />
            <NutritionCard label="Added Sugars" value={avg?.addedSugars || 0} unit="g" />
          </div>
        </section>

        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">7-Day Charts</h2>
          </div>
          
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 mr-2">Show:</span>
            {NUTRIENT_OPTIONS.map(nut => (
              <button
                key={nut.key}
                onClick={() => toggleNutrient(nut.key)}
                className={`px-3 py-1 text-sm rounded-full ${
                  selectedNutrients.includes(nut.key) 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {nut.label}
              </button>
            ))}
          </div>
          
          {selectedNutrients.length > 0 && chartData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg-3 gap-6">
              {selectedNutrients.slice(0, 6).map(nutKey => {
                const nut = NUTRIENT_OPTIONS.find(n => n.key === nutKey);
                if (!nut) return null;
                
                return (
                  <div key={nutKey} className="bg-white rounded-lg shadow p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">{nut.label}</h3>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey={nutKey} fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No data available for charts
            </div>
          )}
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
