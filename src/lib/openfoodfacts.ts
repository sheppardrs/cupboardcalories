import { OpenFoodFactsProduct, OpenFoodFactsSearchResult, NutritionData } from '@/types';

const BASE_URL = 'https://world.openfoodfacts.org';

export async function searchProducts(query: string): Promise<OpenFoodFactsProduct[]> {
  const response = await fetch(
    `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`,
    {
      headers: {
        'User-Agent': 'NutriTrack/1.0',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to search products');
  }
  
  const data: OpenFoodFactsSearchResult = await response.json();
  return data.products.filter(p => p.product_name);
}

export async function getProductByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  const response = await fetch(
    `${BASE_URL}/api/v2/product/${barcode}.json`,
    {
      headers: {
        'User-Agent': 'NutriTrack/1.0',
      },
    }
  );
  
  if (!response.ok) {
    return null;
  }
  
  const data = await response.json();
  return data.product || null;
}

export function convertToNutritionData(
  product: OpenFoodFactsProduct,
  servingSizeGrams: number = 100
): NutritionData {
  const n = product.nutriments || {};
  const ratio = servingSizeGrams / 100;
  
  return {
    calories: Math.round((n['energy-kcal_100g'] || 0) * ratio),
    protein: Math.round((n.proteins_100g || 0) * ratio * 10) / 10,
    carbs: Math.round((n.carbohydrates_100g || 0) * ratio * 10) / 10,
    fat: Math.round((n.fat_100g || 0) * ratio * 10) / 10,
    saturatedFat: Math.round((n['saturated-fat_100g'] || 0) * ratio * 10) / 10,
    cholesterol: 0,
    sodium: Math.round((n.sodium_100g || 0) * ratio * 10) / 10,
    fiber: Math.round((n.fiber_100g || 0) * ratio * 10) / 10,
    sugars: Math.round((n.sugars_100g || 0) * ratio * 10) / 10,
    addedSugars: 0,
  };
}

export function parseServingSize(product: OpenFoodFactsProduct): { size: number; unit: string } | null {
  const serving = product.serving_size;
  if (!serving) return null;
  
  const match = serving.match(/(\d+(?:\.\d+)?)\s*(g|ml|oz)?/i);
  if (match) {
    return {
      size: parseFloat(match[1]),
      unit: match[2] || 'g',
    };
  }
  return null;
}
