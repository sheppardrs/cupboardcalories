# NutriTrack - Longitudinal Nutrition Tracker

## 1. Project Overview

**Project Name**: NutriTrack  
**Type**: Single-user Web Application  
**Core Functionality**: Track nutrition intake at the package level, distributing consumed portions across time until item is finished or repurchased.  
**Target Users**: Individuals who want weekly/monthly nutrition insights without logging every meal.

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Firebase Auth (Google Sign-In) |
| Database | Firebase Firestore |
| OCR | Tesseract.js (client-side) |
| Nutrition Data | OpenFoodFacts API (primary), USDA FoodData Central (fallback) |

---

## 3. Data Models

### 3.1 User
```typescript
interface User {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Date;
}
```

### 3.2 Purchase
```typescript
interface Purchase {
  id: string;
  userId: string;
  date: Date;
  store?: string;
  items: PurchaseItem[];
  createdAt: Date;
}
```

### 3.3 PurchaseItem
```typescript
interface PurchaseItem {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  
  // Nutrition per serving (from API or manual)
  nutritionPerServing: NutritionData;
  servingsPerPackage: number;
  servingSize?: string;
  
  // Consumption tracking
  consumedPercentage: number; // 0-100
  dateOpened?: Date;
  dateFinished?: Date;
  isFinished: boolean;
  
  // Source tracking
  dataSource: 'api' | 'manual' | 'ocr';
}

interface NutritionData {
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
```

### 3.4 DailyNutrition
```typescript
interface DailyNutrition {
  date: string; // YYYY-MM-DD
  userId: string;
  totals: NutritionData;
  items: {
    itemId: string;
    itemName: string;
    portion: number;
    nutrition: NutritionData;
  }[];
}
```

---

## 4. Core Features

### 4.1 Authentication
- Google Sign-In via Firebase Auth
- Protected routes (redirect to login if not authenticated)
- User data isolated by uid

### 4.2 Add Purchase (3 Methods)

**Method A: Manual Entry with API Lookup**
1. User enters product name
2. App queries OpenFoodFacts API
3. User selects correct product from results
4. Nutrition data auto-fills
5. User confirms/adjusts servings per package

**Method B: Barcode Scan**
1. User enters barcode
2. App queries OpenFoodFacts by barcode
3. If found, auto-populates data

**Method C: OCR (Receipt/Nutrition Label)**
1. User uploads image
2. Tesseract.js processes image client-side
3. Attempts to extract: product name, nutrients
4. User verifies/edits extracted data
5. Falls back to manual entry if OCR fails

### 4.3 Consumption Tracking

**Opening an Item**
- User clicks "Start consuming" on a purchase item
- Sets `dateOpened = today`
- Default: `consumedPercentage = 0%`

**Recording Consumption**
- Slider or preset buttons: 25%, 50%, 75%, 100%
- Or enter custom fraction (e.g., "ate 1/3 of package")
- Can update multiple times as item is consumed

**Finishing an Item**
- User clicks "Mark as finished"
- Sets `dateFinished = today`
- If repurchased: creates new PurchaseItem linked to old one

### 4.4 Nutrition Distribution Algorithm

For each item with `consumedPercentage > 0`:
```
totalNutrients = nutritionPerServing × servingsPerPackage × (consumedPercentage / 100)

if (dateFinished):
  daysActive = dateFinished - dateOpened
else:
  daysActive = today - dateOpened

dailyAmount = totalNutrients / max(daysActive, 1)
```

Daily totals = sum of all active items' daily amounts for that date.

### 4.5 Reports

**Weekly View**
- 7-day rolling or calendar week
- Average daily intake per nutrient
- Comparison to previous week

**Monthly View**
- Calendar month totals
- Average daily intake
- Trends chart (line graph)

**Nutrients Tracked**
- Calories, Protein, Carbs, Fat
- Saturated Fat, Unsaturated Fat (if available)
- Cholesterol, Sodium
- Fiber, Sugars, Added Sugars

---

## 5. UI/UX Design

### 5.1 Pages

| Route | Description |
|-------|-------------|
| `/` | Landing/Login page |
| `/dashboard` | Main view - current items, today's nutrition |
| `/purchases` | List of all purchases |
| `/purchases/new` | Add new purchase |
| `/reports` | Weekly/monthly reports |

### 5.2 Components

- **NutritionCard**: Displays single nutrient with progress bar
- **ItemRow**: Purchase item with consumption slider
- **DatePicker**: Select dates for reports
- **SearchInput**: Product search with debounced API calls
- **ImageUploader**: Drag-drop zone for receipt/label photos
- **OCRPreview**: Shows extracted text for verification

---

## 6. API Integrations

### 6.1 OpenFoodFacts API

**Search by name**:
```
GET https://world.openfoodfacts.org/cgi/search.pl
  ?search_terms={query}
  &search_simple=1
  &action=process
  &json=1
  &page_size=10
```

**Get by barcode**:
```
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
```

**Response fields to extract**:
- `product.product_name`
- `product.brands`
- `product.nutriments.energy-kcal_100g`
- `product.nutriments.proteins_100g`
- `product.nutriments.carbohydrates_100g`
- `product.nutriments.fat_100g`
- `product.nutriments.saturated-fat_100g`
- `product.nutriments.sodium_100g`
- `product.nutriments.fiber_100g`
- `product.nutriments.sugars_100g`

**Note**: Data is per 100g - need to convert to per serving.

---

## 7. Acceptance Criteria

- [ ] User can sign in with Google
- [ ] User can add purchase with manually entered nutrition
- [ ] User can search and select product from OpenFoodFacts
- [ ] OCR can extract text from nutrition label image (best effort)
- [ ] User can mark percentage of item consumed
- [ ] User can mark item as finished
- [ ] Dashboard shows current day's nutrition totals
- [ ] Reports show weekly and monthly averages
- [ ] All nutrition data is accurate (from API or user input, never fabricated)
