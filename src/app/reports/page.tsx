'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getPurchases, calculatePeriodNutrition } from '@/lib/db';
import { Purchase, NutritionData } from '@/types';

function NutritionRow({ label, value, unit, highlight = false }: { label: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-3 px-4 ${highlight ? 'bg-emerald-50 -mx-4 rounded-lg' : 'border-b border-gray-100'}`}>
      <span className="text-gray-600">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-emerald-700' : 'text-gray-900'}`}>
        {Math.round(value).toLocaleString()}{unit}
      </span>
    </div>
  );
}

export default function Reports() {
  const { user, loading } = useAuth();
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
              <Link href="/purchases" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Purchases</Link>
              <Link href="/purchases/new" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Add</Link>
              <Link href="/reports" className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md">Reports</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Nutrition Reports</h2>
        <p className="text-gray-500 text-sm mt-1">Track your nutrition over time</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setPeriod('week')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            period === 'week' 
              ? 'bg-emerald-500 text-white' 
              : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
          }`}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setPeriod('month')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            period === 'month' 
              ? 'bg-emerald-500 text-white' 
              : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
          }`}
        >
          Last 30 Days
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Period Summary</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {dayCount} days
            </p>
          </div>
          
          <div>
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

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Daily Average</h3>
            <p className="text-sm text-gray-500 mt-0.5">Based on {dayCount} days of data</p>
          </div>
          
          <div>
            <NutritionRow label="Calories" value={average.calories} unit="" highlight />
            <NutritionRow label="Protein" value={average.protein} unit="g" highlight />
            <NutritionRow label="Carbohydrates" value={average.carbs} unit="g" highlight />
            <NutritionRow label="Fat" value={average.fat} unit="g" highlight />
            <NutritionRow label="Saturated Fat" value={average.saturatedFat} unit="g" />
            <NutritionRow label="Cholesterol" value={average.cholesterol} unit="mg" />
            <NutritionRow label="Sodium" value={average.sodium} unit="mg" />
            <NutritionRow label="Fiber" value={average.fiber} unit="g" />
            <NutritionRow label="Sugars" value={average.sugars} unit="g" />
            <NutritionRow label="Added Sugars" value={average.addedSugars} unit="g" />
          </div>
        </div>
      </div>

      {purchases.length === 0 && (
        <div className="mt-8 bg-white rounded-xl border border-gray-100 p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-4">No data yet.</p>
          <a
            href="/purchases/new"
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Add your first purchase →
          </a>
        </div>
        )}
      </main>
    </div>
  );
}
