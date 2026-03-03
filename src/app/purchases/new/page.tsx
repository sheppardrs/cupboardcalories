'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { createPurchase } from '@/lib/db';
import { searchProducts, getProductByBarcode, convertToNutritionData } from '@/lib/openfoodfacts';
import { processNutritionLabel, ExtractedNutrition } from '@/lib/ocr';
import { PurchaseItem, NutritionData, OpenFoodFactsProduct } from '@/types';

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
  const [ocrDebug, setOcrDebug] = useState<{ text: string; nutrition: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

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

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setOcrProcessing(true);
    setOcrDebug(null);
    try {
      const { text, nutrition } = await processNutritionLabel(file);
      setOcrDebug({ text, nutrition });
      
      const hasNutrientData = Object.entries(nutrition).some(([key, value]) => 
        key !== 'brand' && key !== 'product' && value && Number(value) > 0
      );
      
      if (!hasNutrientData) {
        alert('Could not extract nutrition data from image. Please enter manually.');
        return;
      }
      
      const itemName = nutrition.product || nutrition.brand || '';
      
      const newItem: PurchaseItem = {
        id: Date.now().toString(),
        name: itemName,
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
        consumedPercentage: 0,
        isFinished: false,
        dataSource: 'ocr',
      };
      
      setItems([...items, newItem]);
    } catch (error) {
      console.error('OCR error:', error);
      alert('Failed to process image. Please enter manually.');
    } finally {
      setOcrProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectProduct = (product: OpenFoodFactsProduct) => {
    setSelectedProduct(product);
    setSearchResults([]);
  };

  const addItemFromProduct = () => {
    if (!selectedProduct) return;
    
    const nutrition = convertToNutritionData(selectedProduct);
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      name: selectedProduct.product_name || 'Unknown',
      brand: selectedProduct.brands,
      barcode: selectedProduct.code,
      nutritionPerServing: nutrition,
      servingsPerPackage: 1,
      servingSize: '100g',
      consumedPercentage: 0,
      isFinished: false,
      dataSource: 'api',
    };
    
    setItems([...items, newItem]);
    setSelectedProduct(null);
    setSearchQuery('');
    setBarcode('');
  };

  const addManualItem = () => {
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      name: '',
      nutritionPerServing: { ...emptyNutrition },
      servingsPerPackage: 1,
      consumedPercentage: 0,
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">Add Purchase</h1>
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Find Product</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search by name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g., milk, bread, cereal"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
              {searchResults.map((product) => (
                <button
                  key={product.code}
                  onClick={() => handleSelectProduct(product)}
                  className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50"
                >
                  <p className="font-medium text-gray-900">{product.product_name}</p>
                  <p className="text-sm text-gray-500">{product.brands}</p>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Or enter barcode
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Barcode number"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400"
              />
              <button
                onClick={handleBarcodeLookup}
                disabled={searching}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                {searching ? 'Looking up...' : 'Lookup'}
              </button>
            </div>
          </div>

          {selectedProduct && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-900">{selectedProduct.product_name}</p>
              <p className="text-sm text-green-700">{selectedProduct.brands}</p>
              <button
                onClick={addItemFromProduct}
                className="mt-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Add to Purchase
              </button>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-200">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleOCR}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrProcessing}
              className="text-blue-600 hover:underline mr-4"
            >
              {ocrProcessing ? 'Processing image...' : '+ Scan nutrition label'}
            </button>
            <button
              onClick={addManualItem}
              className="text-blue-600 hover:underline"
            >
              + Enter manually (no match found)
            </button>
          </div>
        </section>

        {ocrDebug && (
          <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-yellow-800 mb-2">OCR Extracted Text (for debugging)</h3>
            <pre className="text-xs text-yellow-700 whitespace-pre-wrap max-h-32 overflow-y-auto mb-2">
              {ocrDebug.text}
            </pre>
            <div className="text-sm text-yellow-800">
              <strong>Parsed values:</strong> {JSON.stringify(ocrDebug.nutrition)}
            </div>
          </section>
        )}

        {items.length > 0 && (
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Items ({items.length})</h2>
            
            {items.map((item, index) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm text-gray-500">Item {index + 1}</span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, { name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Brand
                    </label>
                    <input
                      type="text"
                      value={item.brand || ''}
                      onChange={(e) => updateItem(item.id, { brand: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Calories
                    </label>
                    <input
                      type="number"
                      value={item.nutritionPerServing.calories}
                      onChange={(e) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, calories: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Protein (g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.nutritionPerServing.protein}
                      onChange={(e) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, protein: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carbs (g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.nutritionPerServing.carbs}
                      onChange={(e) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, carbs: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fat (g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.nutritionPerServing.fat}
                      onChange={(e) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, fat: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sat. Fat (g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.nutritionPerServing.saturatedFat}
                      onChange={(e) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, saturatedFat: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cholesterol (mg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.nutritionPerServing.cholesterol}
                      onChange={(e) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, cholesterol: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sodium (mg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.nutritionPerServing.sodium}
                      onChange={(e) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, sodium: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fiber (g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.nutritionPerServing.fiber}
                      onChange={(e) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, fiber: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sugars (g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.nutritionPerServing.sugars}
                      onChange={(e) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, sugars: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Added Sugars (g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.nutritionPerServing.addedSugars}
                      onChange={(e) => updateItem(item.id, { 
                        nutritionPerServing: { ...item.nutritionPerServing, addedSugars: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Servings per package
                  </label>
                  <input
                    type="number"
                    value={item.servingsPerPackage}
                    onChange={(e) => updateItem(item.id, { servingsPerPackage: parseFloat(e.target.value) || 1 })}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  />
                  <span className="ml-2 text-sm text-gray-500">
                    (per serving: {item.nutritionPerServing.calories} cal)
                  </span>
                </div>
              </div>
            ))}

            <button
              onClick={addManualItem}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-gray-400 hover:text-gray-600"
            >
              + Add Another Item
            </button>

            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={() => router.back()}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || items.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Purchase'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
