# NutriTrack

A longitudinal nutrition tracking app that tracks nutrition at the package level. Unlike traditional meal logging, NutriTrack lets you input full packages at purchase and distributes the nutrition across the consumption window until the item is finished or repurchased.

## Features

- **Google Authentication** - Secure sign-in with Firebase
- **Multiple Input Methods**
  - Manual entry with OpenFoodFacts API lookup
  - Barcode scanning via OpenFoodFacts
  - OCR from nutrition label images (local Ollama VLM)
- **Batch Image Upload** - Upload multiple images, review all extractions before saving
- **Portion Tracking** - Set what percentage of each package you plan to consume
- **Consumption Dates** - Track when you start and finish items
- **Weekly Averages** - View daily nutrition averages for the current week
- **Interactive Charts** - Toggle which nutrients to display (calories, carbs, protein, fat, saturatedFat)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Firebase Auth (Google Sign-In) |
| Database | Firebase Firestore |
| OCR | Ollama + qwen3-vl:2b model |
| Nutrition Data | OpenFoodFacts API |
| Validation | Zod |
| Charts | Recharts |

## Prerequisites

- Node.js 18+
- [Ollama](https://ollama.com) installed locally
- Firebase project with Auth and Firestore enabled

## Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## How to Run

You need three terminal windows (or tabs):

### Terminal 1: Start Ollama
```bash
ollama serve
```

### Terminal 2: Start VLM Server
```bash
cd server
node vlm-server.js
```

### Terminal 3: Start Next.js
```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

## Data Model

### PurchaseItem
```typescript
interface PurchaseItem {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  nutritionPerServing: NutritionData;
  servingsPerPackage: number;
  servingSize?: string;
  userPortion: number;        // % of package user will consume (0-100)
  consumedPercentage: number; // % of user's portion consumed (0-100)
  dateOpened?: string;
  dateFinished?: string;
  isFinished: boolean;
  dataSource: 'api' | 'manual' | 'ocr';
  purchaseId?: string;
  purchaseDate?: string;
}
```

### NutritionData
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

### UserSettings
```typescript
interface UserSettings {
  defaultFinishDays: number; // default: 14
}
```

## Project Structure

```
/home/bobby/Documents/nutritionapp/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx       # Weekly averages, charts, active items
│   │   ├── purchases/
│   │   │   ├── page.tsx       # List purchases, editable dates/portions
│   │   │   └── new/
│   │   │       └── page.tsx   # Add purchase, batch upload, review
│   │   ├── reports/
│   │   │   └── page.tsx       # Weekly/monthly reports
│   │   ├── layout.tsx         # Root layout with AuthProvider
│   │   └── page.tsx           # Login page
│   ├── lib/
│   │   ├── db.ts              # Firestore CRUD, nutrition calculations
│   │   ├── firebase.ts        # Firebase config
│   │   ├── settings.ts        # User settings CRUD
│   │   ├── ocr.ts             # OCR client (calls VLM server)
│   │   ├── openfoodfacts.ts   # Product search API
│   │   └── nutrition-schema.ts # Zod validation schema
│   ├── contexts/
│   │   └── auth-context.tsx  # Firebase auth context
│   └── types/
│       └── index.ts           # TypeScript interfaces
├── server/
│   └── vlm-server.js          # Express server for Ollama VLM
├── uploads/                   # Temp directory for image uploads
├── SPEC.md                    # Full specification document
└── package.json
```

## Nutrition Distribution Formula

When you consume a portion of a package, the nutrition is distributed evenly across the days you've:

```
totalNutrients = nutritionPerServing × servingsPerPackage × (userPortion / 100) × (consumedPercentage / 100)
daysActive = dateFinished - dateOpened (or today if not finished)
dailyAmount = totalNutrients / max(daysActive, 1)
```

This means if you eat half a package over 10 days, you'll get 1/20th of the nutrition each day rather than logging it all at once.

## License

MIT
