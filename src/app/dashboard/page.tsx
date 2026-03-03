'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getPurchases, calculatePeriodNutrition } from '@/lib/db';
import { Purchase, PurchaseItem, NutritionData } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const NUTRIENT_OPTIONS = [
  { key: 'calories', label: 'Calories', unit: '', color: '#10b981' },
  { key: 'protein', label: 'Protein', unit: 'g', color: '#3b82f6' },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: '#8b5cf6' },
  { key: 'fat', label: 'Fat', unit: 'g', color: '#f59e0b' },
  { key: 'saturatedFat', label: 'Saturated Fat', unit: 'g', color: '#ef4444' },
];

function NutritionCard({ label, value, unit, color = 'emerald' }: { label: string; value: number; unit: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    emerald: 'from-emerald-50 to-teal-50 border-emerald-100',
    blue: 'from-blue-50 to-indigo-50 border-blue-100',
    purple: 'from-purple-50 to-violet-50 border-purple-100',
    amber: 'from-amber-50 to-orange-50 border-amber-100',
    red: 'from-red-50 to-rose-50 border-red-100',
  };
  
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl border p-4`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {Math.round(value).toLocaleString()}<span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
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
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{item.name}</h3>
          {item.brand && <p className="text-sm text-gray-500">{item.brand}</p>}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          item.isFinished 
            ? 'bg-gray-100 text-gray-600' 
            : 'bg-emerald-100 text-emerald-700'
        }`}>
          {item.isFinished ? 'Finished' : 'Active'}
        </span>
      </div>
      
      <div className="space-y-3">
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
            disabled={item.isFinished}
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
            disabled={item.isFinished}
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
                disabled={item.isFinished}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {item.dateOpened && (
        <p className="text-xs text-gray-400 mt-3">
          Started {new Date(item.dateOpened).toLocaleDateString()}
          {item.dateFinished && ` → Finish ${new Date(item.dateFinished).toLocaleDateString()}`}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, loading } = useAuth();
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  const avg = weeklyData?.average;

  return (
    <div className="min-h-screen bg-slate-50">
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
              <Link href="/dashboard" className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md">Dashboard</Link>
              <Link href="/purchases" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Purchases</Link>
              <Link href="/purchases/new" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Add</Link>
              <Link href="/reports" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Reports</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-8">
        <p className="text-gray-500 text-sm">{today}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Welcome back!</h1>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">This Week&apos;s Daily Average</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <NutritionCard label="Calories" value={avg?.calories || 0} unit="" color="emerald" />
          <NutritionCard label="Protein" value={avg?.protein || 0} unit="g" color="blue" />
          <NutritionCard label="Carbs" value={avg?.carbs || 0} unit="g" color="purple" />
          <NutritionCard label="Fat" value={avg?.fat || 0} unit="g" color="amber" />
          <NutritionCard label="Sat. Fat" value={avg?.saturatedFat || 0} unit="g" color="red" />
        </div>
      </section>

      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">7-Day Charts</h2>
        </div>
        
        <div className="mb-4 flex flex-wrap gap-2">
          {NUTRIENT_OPTIONS.map(nut => {
            const isSelected = selectedNutrients.includes(nut.key);
            return (
              <button
                key={nut.key}
                onClick={() => toggleNutrient(nut.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                  isSelected 
                    ? 'text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
                style={isSelected ? { backgroundColor: nut.color } : undefined}
              >
                {nut.label}
              </button>
            );
          })}
        </div>
        
        {selectedNutrients.length > 0 && chartData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedNutrients.slice(0, 6).map(nutKey => {
              const nut = NUTRIENT_OPTIONS.find(n => n.key === nutKey);
              if (!nut) return null;
              
              return (
                <div key={nutKey} className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">{nut.label}</h3>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Bar 
                        dataKey={nutKey} 
                        fill={nut.color} 
                        radius={[4, 4, 0, 0]} 
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
            No data available for charts
          </div>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Items</h2>
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
        
        {activeItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">No active items yet.</p>
            <Link
              href="/purchases/new"
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Add your first purchase →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeItems.slice(0, 6).map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onUpdate={(updates) => console.log('Update:', item.id, updates)}
              />
            ))}
          </div>
        )}
        
        {activeItems.length > 6 && (
          <div className="mt-4 text-center">
            <Link
              href="/purchases"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              View all {activeItems.length} items →
            </Link>
          </div>
          )}
        </section>
      </main>
    </div>
  );
}
