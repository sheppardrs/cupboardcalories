'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { createPurchase } from '@/lib/db';
import { getUserSettings } from '@/lib/settings';
import { searchProducts, getProductByBarcode, convertToNutritionData } from '@/lib/openfoodfacts';
import { processNutritionLabel, ExtractedNutrition } from '@/lib/ocr';
import { PurchaseItem, NutritionData, OpenFoodFactsProduct, UserSettings } from '@/types';

const emptyNutrition: NutritionData = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  saturatedFat: 0,
  cholesterol: 0,
  sodium: 0,
  fiber: 0,
  sugars: 0,
  addedSugars: 0,
};

function InputField({ 
  label, 
  value, 
  onChange, 
  type = 'text',
  placeholder = '',
  className = '',
  ...props 
}: { 
  label: string; 
  value: string | number; 
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  [key: string]: any;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
        {...props}
      />
    </div>
  );
}

export default function NewPurchase() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OpenFoodFactsProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<OpenFoodFactsProduct | null>(null);
  const [barcode, setBarcode] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [pendingItems, setPendingItems] = useState<PurchaseItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({ defaultFinishDays: 14 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      getUserSettings(user.uid).then(setSettings);
    }
  }, [user]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchProducts(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleBarcodeLookup = async () => {
    if (!barcode.trim()) return;
    setSearching(true);
    try {
      const product = await getProductByBarcode(barcode);
      if (product) {
        setSelectedProduct(product);
      } else {
        alert('Product not found. Try searching by name or enter manually.');
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
    } finally {
      setSearching(false);
    }
  };

  const createItemFromNutrition = (nutrition: ExtractedNutrition): PurchaseItem => {
    const today = new Date();
    const defaultFinish = new Date(today);
    defaultFinish.setDate(today.getDate() + settings.defaultFinishDays);
    
    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: nutrition.product || nutrition.brand || '',
      brand: nutrition.brand || '',
      nutritionPerServing: {
        calories: nutrition.calories || 0,
        protein: nutrition.protein || 0,
        carbs: nutrition.carbs || 0,
        fat: nutrition.fat || 0,
        saturatedFat: nutrition.saturatedFat || 0,
        cholesterol: 0,
        sodium: nutrition.sodium || 0,
        fiber: nutrition.fiber || 0,
        sugars: nutrition.sugars || 0,
        addedSugars: nutrition.addedSugars || 0,
      },
      servingsPerPackage: 1,
      userPortion: 100,
      consumedPercentage: 0,
      dateOpened: today.toISOString().split('T')[0],
      dateFinished: defaultFinish.toISOString().split('T')[0],
      isFinished: false,
      dataSource: 'ocr',
    };
  };

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setOcrProcessing(true);
    
    const newPendingItems: PurchaseItem[] = [];
    
    try {
      for (const file of Array.from(files)) {
        const { nutrition } = await processNutritionLabel(file);
        
        const hasNutrientData = Object.entries(nutrition).some(([key, value]) => 
          key !== 'brand' && key !== 'product' && value && Number(value) > 0
        );
        
        if (hasNutrientData) {
          const newItem = createItemFromNutrition(nutrition);
          newPendingItems.push(newItem);
        }
      }
      
      if (newPendingItems.length > 0) {
        setPendingItems([...pendingItems, ...newPendingItems]);
        setShowReview(true);
      } else {
        alert('Could not extract nutrition data from images. Please enter manually.');
      }
    } catch (error) {
      console.error('OCR error:', error);
      alert('Failed to process images. Please enter manually.');
    } finally {
      setOcrProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReviewConfirm = () => {
    setItems([...items, ...pendingItems]);
    setPendingItems([]);
    setShowReview(false);
  };

  const handleReviewUpdate = (index: number, updates: Partial<PurchaseItem>) => {
    const updated = [...pendingItems];
    updated[index] = { ...updated[index], ...updates };
    setPendingItems(updated);
  };

  const handleReviewRemove = (index: number) => {
    setPendingItems(pendingItems.filter((_, i) => i !== index));
  };

  const handleSelectProduct = (product: OpenFoodFactsProduct) => {
    setSelectedProduct(product);
    setSearchResults([]);
  };

  const addItemFromProduct = () => {
    if (!selectedProduct) return;
    
    const nutrition = convertToNutritionData(selectedProduct);
    const today = new Date();
    const defaultFinish = new Date(today);
    defaultFinish.setDate(today.getDate() + settings.defaultFinishDays);
    
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      name: selectedProduct.product_name || 'Unknown',
      brand: selectedProduct.brands,
      barcode: selectedProduct.code,
      nutritionPerServing: nutrition,
      servingsPerPackage: 1,
      servingSize: '100g',
      userPortion: 100,
      consumedPercentage: 0,
      dateOpened: today.toISOString().split('T')[0],
      dateFinished: defaultFinish.toISOString().split('T')[0],
      isFinished: false,
      dataSource: 'api',
    };
    
    setItems([...items, newItem]);
    setSelectedProduct(null);
    setSearchQuery('');
    setBarcode('');
  };

  const addManualItem = () => {
    const today = new Date();
    const defaultFinish = new Date(today);
    defaultFinish.setDate(today.getDate() + settings.defaultFinishDays);
    
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      name: '',
      nutritionPerServing: { ...emptyNutrition },
      servingsPerPackage: 1,
      userPortion: 100,
      consumedPercentage: 0,
      dateOpened: today.toISOString().split('T')[0],
      dateFinished: defaultFinish.toISOString().split('T')[0],
      isFinished: false,
      dataSource: 'manual',
    };
    setItems([...items, newItem]);
    setShowManualEntry(false);
  };

  const updateItem = (id: string, updates: Partial<PurchaseItem>) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    if (!user || items.length === 0) return;
    
    const validItems = items.filter(item => item.name.trim());
    if (validItems.length === 0) {
      alert('Please add at least one item with a name');
      return;
    }
    
    setSaving(true);
    try {
      await createPurchase(user.uid, {
        date: new Date().toISOString().split('T')[0],
        items: validItems,
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('Failed to save purchase');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
              <Link href="/purchases/new" className="px-3 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md">Add</Link>
              <Link href="/reports" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Reports</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors mb-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Add Purchase</h2>
        <p className="text-gray-500 text-sm mt-1">Add items by searching, scanning barcodes, or uploading nutrition labels</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Find Product</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Search by name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., milk, bread, cereal"
              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto mb-4">
            {searchResults.map((product) => (
              <button
                key={product.code}
                onClick={() => handleSelectProduct(product)}
                className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-emerald-50 transition-colors last:border-0"
              >
                <p className="font-medium text-gray-900">{product.product_name}</p>
                <p className="text-sm text-gray-500">{product.brands}</p>
              </button>
            ))}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Or enter barcode</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Barcode number"
              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <button
              onClick={handleBarcodeLookup}
              disabled={searching}
              className="bg-gray-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {searching ? 'Looking...' : 'Lookup'}
            </button>
          </div>
        </div>

        {selectedProduct && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="font-semibold text-emerald-900">{selectedProduct.product_name}</p>
            <p className="text-sm text-emerald-700">{selectedProduct.brands}</p>
            <button
              onClick={addItemFromProduct}
              className="mt-2 bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-600 transition-colors"
            >
              Add to Purchase
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 flex flex-wrap gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleOCR}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrProcessing}
            className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
          >
            {ocrProcessing ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Scan nutrition labels
              </>
            )}
          </button>
          <button
            onClick={addManualItem}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-700 font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Enter manually
          </button>
        </div>
      </div>

      {showReview && pendingItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-amber-900">Review Extracted Items ({pendingItems.length})</h3>
            <button
              onClick={() => setShowReview(false)}
              className="text-amber-700 hover:text-amber-900 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
          
          <div className="space-y-4">
            {pendingItems.map((item, index) => (
              <div key={item.id} className="bg-white rounded-lg border border-amber-200 p-4">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm font-medium text-gray-500">Item {index + 1}</span>
                  <button
                    onClick={() => handleReviewRemove(index)}
                    className="text-red-500 hover:text-red-600 text-sm"
                  >
                    Remove
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleReviewUpdate(index, { name: e.target.value })}
                    placeholder="Product name"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-gray-900"
                  />
                  <input
                    type="text"
                    value={item.brand || ''}
                    onChange={(e) => handleReviewUpdate(index, { brand: e.target.value })}
                    placeholder="Brand"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-gray-900"
                  />
                </div>
                
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3 text-sm">
                  {['calories', 'protein', 'carbs', 'fat', 'saturatedFat', 'sodium'].map(field => (
                    <div key={field}>
                      <label className="text-xs text-gray-500 capitalize">{field}</label>
                      <input
                        type="number"
                        value={field === 'calories' || field === 'sodium' 
                          ? item.nutritionPerServing[field as keyof NutritionData]
                          : Math.round((item.nutritionPerServing[field as keyof NutritionData] as number) * 10) / 10
                        }
                        onChange={(e) => handleReviewUpdate(index, { 
                          nutritionPerServing: { ...item.nutritionPerServing, [field]: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-gray-900"
                      />
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label="My Portion (%)"
                    type="number"
                    value={item.userPortion}
                    onChange={(v) => handleReviewUpdate(index, { userPortion: parseInt(v) || 0 })}
                  />
                  <InputField
                    label="Servings per package"
                    type="number"
                    value={item.servingsPerPackage}
                    onChange={(v) => handleReviewUpdate(index, { servingsPerPackage: parseFloat(v) || 1 })}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setShowReview(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Keep Editing
            </button>
            <button
              onClick={handleReviewConfirm}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              Add All Items
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Items ({items.length})</h3>
          
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm font-medium text-gray-500">Item {index + 1}</span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-500 hover:text-red-600 text-sm"
                  >
                    Remove
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <InputField
                    label="Product Name *"
                    value={item.name}
                    onChange={(v) => updateItem(item.id, { name: v })}
                  />
                  <InputField
                    label="Brand"
                    value={item.brand || ''}
                    onChange={(v) => updateItem(item.id, { brand: v })}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                  {[
                    { key: 'calories', label: 'Calories' },
                    { key: 'protein', label: 'Protein (g)' },
                    { key: 'carbs', label: 'Carbs (g)' },
                    { key: 'fat', label: 'Fat (g)' },
                    { key: 'saturatedFat', label: 'Sat. Fat (g)' },
                  ].map(({ key, label }) => (
                    <InputField
                      key={key}
                      label={label}
                      type="number"
                      value={item.nutritionPerServing[key as keyof NutritionData] as number}
                      onChange={(v) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, [key]: parseFloat(v) || 0 }
                      })}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                  {[
                    { key: 'cholesterol', label: 'Cholesterol (mg)' },
                    { key: 'sodium', label: 'Sodium (mg)' },
                    { key: 'fiber', label: 'Fiber (g)' },
                    { key: 'sugars', label: 'Sugars (g)' },
                    { key: 'addedSugars', label: 'Added Sugars (g)' },
                  ].map(({ key, label }) => (
                    <InputField
                      key={key}
                      label={label}
                      type="number"
                      value={item.nutritionPerServing[key as keyof NutritionData] as number}
                      onChange={(v) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, [key]: parseFloat(v) || 0 }
                      })}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <InputField
                    label="Servings per pkg"
                    type="number"
                    value={item.servingsPerPackage}
                    onChange={(v) => updateItem(item.id, { servingsPerPackage: parseFloat(v) || 1 })}
                  />
                  <InputField
                    label="My Portion (%)"
                    type="number"
                    value={item.userPortion || 100}
                    onChange={(v) => updateItem(item.id, { userPortion: parseInt(v) || 100 })}
                  />
                  <InputField
                    label="Start Date"
                    type="date"
                    value={item.dateOpened || ''}
                    onChange={(v) => updateItem(item.id, { dateOpened: v })}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addManualItem}
            className="w-full mt-4 border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            + Add Another Item
          </button>

          <div className="mt-6 flex justify-end gap-4">
            <button
              onClick={() => router.back()}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || items.length === 0}
              className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Purchase'}
            </button>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
