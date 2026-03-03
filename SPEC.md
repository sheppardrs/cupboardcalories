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
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Firebase Auth (Google Sign-In) |
| Database | Firebase Firestore |
| OCR | Ollama (local VLM) with qwen3-vl:2b model |
| Nutrition Data | OpenFoodFacts API |
| Validation | Zod |
| Charts | Recharts |

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
  date: string;
  store?: string;
  items: PurchaseItem[];
  createdAt: string;
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
  
  // User's planned portion (what % of package they will eat)
  userPortion: number; // 0-100 percentage
  
  // Actual consumption tracking
  consumedPercentage: number; // 0-100, how much of user's portion has been consumed
  dateOpened?: string;
  dateFinished?: string;
  isFinished: boolean;
  
  // Source tracking
  dataSource: 'api' | 'manual' | 'ocr';
  purchaseId?: string;
  purchaseDate?: string;
}
```

### 3.4 NutritionData
```typescript
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

### 3.5 UserSettings
```typescript
interface UserSettings {
  defaultFinishDays: number; // default: 14
}
```

### 3.6 DailyNutrition
```typescript
interface DailyNutrition {
  date: string; // YYYY-MM-DD
  userId: string;
  totals: NutritionData;
}
```

---

## 4. Core Features

### 4.1 Authentication
- Google Sign-In via Firebase Auth
- Protected routes (redirect to login if not authenticated)
- User data isolated by Firebase UID
- Sign out available from all main pages

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

**Method C: OCR (Nutrition Label Image)**
1. User uploads image(s) of nutrition label
2. Express server forwards to local Ollama instance
3. Vision model (qwen3-vl:2b) extracts nutrition data using Zod schema
4. User verifies/edits extracted data
5. Supports **batch uploads** - multiple images processed in sequence
6. User reviews all extracted items before saving

### 4.3 Consumption Tracking

**Setting Your Portion**
- When adding an item, user sets "My Portion" slider (0-100%)
- This defines what percentage of the package they plan to consume
- Can be edited later in the purchases list

**Opening an Item**
- User clicks "Start consuming" on a purchase item
- Sets `dateOpened = today`
- Default: `consumedPercentage = 0%`

**Recording Consumption**
- Slider or preset buttons: 25%, 50%, 75%, 100%
- Can update multiple times as item is consumed

**Finishing an Item**
- User clicks "Mark as finished"
- Sets `dateFinished = today`

### 4.4 Nutrition Distribution Algorithm

For each item with `consumedPercentage > 0`:
```
totalNutrients = nutritionPerServing × servingsPerPackage × (userPortion / 100) × (consumedPercentage / 100)

if (dateFinished):
  daysActive = dateFinished - dateOpened
else:
  daysActive = today - dateOpened

dailyAmount = totalNutrients / max(daysActive, 1)
```

Daily totals = sum of all active items' daily amounts for that date.

### 4.5 Dashboard

- **This Week's Daily Average**: Shows average daily nutrition for current week
- **Interactive Charts**: Toggle which nutrients to display (calories, carbs, protein, fat, saturatedFat)
- **Active Items**: List of items currently being consumed

### 4.6 Reports

- **Weekly View**: 7-day rolling average per nutrient
- **Monthly View**: Calendar month totals and averages

---

## 5. UI/UX Design

### 5.1 Pages

| Route | Description |
|-------|-------------|
| `/` | Landing/Login page with Google Sign-In |
| `/dashboard` | Main view - weekly averages, charts, active items |
| `/purchases` | List of all purchases with editable dates and portions |
| `/purchases/new` | Add new purchase with batch image upload |
| `/reports` | Weekly/monthly reports |

### 5.2 Components

- **NutritionCard**: Displays single nutrient with progress bar
- **ItemRow**: Purchase item with consumption slider
- **DatePicker**: Inline date selection for start/finish dates
- **SearchInput**: Product search with debounced API calls
- **ImageUploader**: Drag-drop zone for receipt/label photos
- **BatchReviewList**: Shows all extracted items for user confirmation
- **ChartPanel**: Interactive Recharts with nutrient toggles

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

**Response fields extracted**:
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

**Note**: Data is per 100g - converted to per serving.

### 6.2 Ollama VLM (OCR)

**Server**: Express.js on port 5000  
**Model**: qwen3-vl:2b  
**Endpoint**: `POST /extract` (multipart/form-data with image)

**Features**:
- Structured JSON output via Zod schema
- Low temperature (0.1) for consistent results
- Returns: brand, product, calories, protein, carbs, fat, saturatedFat, sodium, fiber, sugars, addedSugars

---

## 7. Acceptance Criteria

- [x] User can sign in with Google
- [x] User can add purchase with manually entered nutrition
- [x] User can search and select product from OpenFoodFacts
- [x] User can upload nutrition label images for OCR extraction
- [x] Batch image uploads with review flow
- [x] User can set "My Portion" percentage (what % of package they'll eat)
- [x] User can mark percentage of item consumed
- [x] User can mark item as finished with finish date
- [x] Dashboard shows weekly daily averages with interactive charts
- [x] User can toggle which nutrients to display on charts
- [x] All nutrition data is accurate (from API or user input, never fabricated)
- [x] User settings for default finish days (stored in Firestore)
