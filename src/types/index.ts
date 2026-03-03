export interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat: number;
  unsaturatedFat?: number;
  cholesterol: number;
  sodium: number;
  fiber: number;
  sugars: number;
  addedSugars: number;
}

export interface PurchaseItem {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  nutritionPerServing: NutritionData;
  servingsPerPackage: number;
  servingSize?: string;
  consumedPercentage: number;
  dateOpened?: string;
  dateFinished?: string;
  isFinished: boolean;
  dataSource: 'api' | 'manual' | 'ocr';
  purchaseId?: string;
  purchaseDate?: string;
}

export interface Purchase {
  id: string;
  userId: string;
  date: string;
  store?: string;
  items: PurchaseItem[];
  createdAt: string;
}

export interface DailyNutrition {
  date: string;
  userId: string;
  totals: NutritionData;
}

export interface OpenFoodFactsProduct {
  code: string;
  product_name?: string;
  brands?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    'saturated-fat_100g'?: number;
    sodium_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
  };
  serving_size?: string;
}

export interface OpenFoodFactsSearchResult {
  products: OpenFoodFactsProduct[];
  count: number;
}
