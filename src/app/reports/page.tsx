'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getPurchases, calculatePeriodNutrition } from '@/lib/db';
import { Purchase, NutritionData } from '@/types';

function NutritionRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{value.toLocaleString()}{unit}</span>
    </div>
  );
}

export default function Reports() {
  const { user, loading, logOut } = useAuth();
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
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

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  const allItems = purchases.flatMap(p => 
    p.items.map(item => ({ ...item, purchaseId: p.id, purchaseDate: p.date }))
  );

  const today = new Date();
  let startDate: string;
  let endDate: string;

  if (period === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    startDate = weekAgo.toISOString().split('T')[0];
    endDate = today.toISOString().split('T')[0];
  } else {
    const monthAgo = new Date(today);
    monthAgo.setMonth(today.getMonth() - 1);
    startDate = monthAgo.toISOString().split('T')[0];
    endDate = today.toISOString().split('T')[0];
  }

  const { totals, average, daily } = calculatePeriodNutrition(allItems, startDate, endDate);
  const dayCount = Math.max(1, daily.length);

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
          <h2 className="text-2xl font-bold text-gray-900">Nutrition Reports</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-2 rounded-lg ${period === 'week' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 rounded-lg ${period === 'month' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
            >
              Last 30 Days
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Period: {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</h3>
            <p className="text-sm text-gray-500">{dayCount} days</p>
          </div>
          
          <div className="p-4">
            <h4 className="font-medium text-gray-700 mb-2">Total Consumption</h4>
            <NutritionRow label="Calories" value={totals.calories} unit="" />
            <NutritionRow label="Protein" value={totals.protein} unit="g" />
            <NutritionRow label="Carbohydrates" value={totals.carbs} unit="g" />
            <NutritionRow label="Fat" value={totals.fat} unit="g" />
            <NutritionRow label="Saturated Fat" value={totals.saturatedFat} unit="g" />
            <NutritionRow label="Cholesterol" value={totals.cholesterol} unit="mg" />
            <NutritionRow label="Sodium" value={totals.sodium} unit="mg" />
            <NutritionRow label="Fiber" value={totals.fiber} unit="g" />
            <NutritionRow label="Sugars" value={totals.sugars} unit="g" />
            <NutritionRow label="Added Sugars" value={totals.addedSugars} unit="g" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Daily Average</h3>
            <p className="text-sm text-gray-500">Based on {dayCount} days</p>
          </div>
          
          <div className="p-4">
            <NutritionRow label="Calories" value={average.calories} unit="" />
            <NutritionRow label="Protein" value={average.protein} unit="g" />
            <NutritionRow label="Carbohydrates" value={average.carbs} unit="g" />
            <NutritionRow label="Fat" value={average.fat} unit="g" />
            <NutritionRow label="Saturated Fat" value={average.saturatedFat} unit="g" />
            <NutritionRow label="Cholesterol" value={average.cholesterol} unit="mg" />
            <NutritionRow label="Sodium" value={average.sodium} unit="mg" />
            <NutritionRow label="Fiber" value={average.fiber} unit="g" />
            <NutritionRow label="Sugars" value={average.sugars} unit="g" />
            <NutritionRow label="Added Sugars" value={average.addedSugars} unit="g" />
          </div>
        </div>

        {purchases.length === 0 && (
          <div className="mt-8 text-center">
            <p className="text-gray-500 mb-4">No data yet.</p>
            <a
              href="/purchases/new"
              className="text-blue-600 hover:underline"
            >
              Add your first purchase
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
