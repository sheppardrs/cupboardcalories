import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Purchase, PurchaseItem, NutritionData } from '@/types';

const PURCHASES_COLLECTION = 'purchases';

export async function createPurchase(userId: string, purchase: Omit<Purchase, 'id' | 'createdAt' | 'userId'>): Promise<string> {
  const docRef = await addDoc(collection(db, PURCHASES_COLLECTION), {
    ...purchase,
    userId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updatePurchase(userId: string, purchaseId: string, updates: Partial<Purchase>): Promise<void> {
  const docRef = doc(db, PURCHASES_COLLECTION, purchaseId);
  await updateDoc(docRef, updates);
}

export async function deletePurchase(userId: string, purchaseId: string): Promise<void> {
  const docRef = doc(db, PURCHASES_COLLECTION, purchaseId);
  await deleteDoc(docRef);
}

export async function getPurchases(userId: string): Promise<Purchase[]> {
  const q = query(
    collection(db, PURCHASES_COLLECTION),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Purchase[];
}

export async function getPurchaseById(userId: string, purchaseId: string): Promise<Purchase | null> {
  const docRef = doc(db, PURCHASES_COLLECTION, purchaseId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists() || snapshot.data().userId !== userId) {
    return null;
  }
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Purchase;
}

export async function updatePurchaseItem(
  userId: string, 
  purchaseId: string, 
  itemId: string, 
  updates: Partial<PurchaseItem>
): Promise<void> {
  const purchase = await getPurchaseById(userId, purchaseId);
  if (!purchase) throw new Error('Purchase not found');
  
  const updatedItems = purchase.items.map(item => 
    item.id === itemId ? { ...item, ...updates } : item
  );
  
  await updatePurchase(userId, purchaseId, { items: updatedItems });
}

export async function getActiveItems(userId: string): Promise<PurchaseItem[]> {
  const purchases = await getPurchases(userId);
  const activeItems: PurchaseItem[] = [];
  
  for (const purchase of purchases) {
    for (const item of purchase.items) {
      if (item.dateOpened && !item.isFinished) {
        activeItems.push({
          ...item,
          purchaseId: purchase.id,
          purchaseDate: purchase.date,
        });
      }
    }
  }
  
  return activeItems;
}

export function calculateDailyNutrition(
  items: (PurchaseItem & { purchaseId?: string; purchaseDate?: string })[],
  date: string
): NutritionData {
  const totals: NutritionData = {
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
  
  const dateOpened = new Date(date);
  
  for (const item of items) {
    if (!item.dateOpened) continue;
    
    const opened = new Date(item.dateOpened);
    const finished = item.dateFinished ? new Date(item.dateFinished) : new Date(date);
    
    if (dateOpened < opened || dateOpened > finished) continue;
    
    const daysActive = Math.max(1, Math.ceil((finished.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyPortion = item.consumedPercentage / 100 / daysActive;
    
    totals.calories += item.nutritionPerServing.calories * item.servingsPerPackage * dailyPortion;
    totals.protein += item.nutritionPerServing.protein * item.servingsPerPackage * dailyPortion;
    totals.carbs += item.nutritionPerServing.carbs * item.servingsPerPackage * dailyPortion;
    totals.fat += item.nutritionPerServing.fat * item.servingsPerPackage * dailyPortion;
    totals.saturatedFat += item.nutritionPerServing.saturatedFat * item.servingsPerPackage * dailyPortion;
    totals.cholesterol += item.nutritionPerServing.cholesterol * item.servingsPerPackage * dailyPortion;
    totals.sodium += item.nutritionPerServing.sodium * item.servingsPerPackage * dailyPortion;
    totals.fiber += item.nutritionPerServing.fiber * item.servingsPerPackage * dailyPortion;
    totals.sugars += item.nutritionPerServing.sugars * item.servingsPerPackage * dailyPortion;
    totals.addedSugars += item.nutritionPerServing.addedSugars * item.servingsPerPackage * dailyPortion;
  }
  
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    saturatedFat: Math.round(totals.saturatedFat * 10) / 10,
    cholesterol: Math.round(totals.cholesterol * 10) / 10,
    sodium: Math.round(totals.sodium * 10) / 10,
    fiber: Math.round(totals.fiber * 10) / 10,
    sugars: Math.round(totals.sugars * 10) / 10,
    addedSugars: Math.round(totals.addedSugars * 10) / 10,
  };
}

export function calculatePeriodNutrition(
  items: (PurchaseItem & { purchaseId?: string; purchaseDate?: string })[],
  startDate: string,
  endDate: string
): { daily: NutritionData[]; totals: NutritionData; average: NutritionData } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days: NutritionData[] = [];
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    days.push(calculateDailyNutrition(items, dateStr));
  }
  
  const totals: NutritionData = {
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
  
  for (const day of days) {
    totals.calories += day.calories;
    totals.protein += day.protein;
    totals.carbs += day.carbs;
    totals.fat += day.fat;
    totals.saturatedFat += day.saturatedFat;
    totals.cholesterol += day.cholesterol;
    totals.sodium += day.sodium;
    totals.fiber += day.fiber;
    totals.sugars += day.sugars;
    totals.addedSugars += day.addedSugars;
  }
  
  const dayCount = Math.max(1, days.length);
  const average: NutritionData = {
    calories: Math.round(totals.calories / dayCount),
    protein: Math.round(totals.protein / dayCount * 10) / 10,
    carbs: Math.round(totals.carbs / dayCount * 10) / 10,
    fat: Math.round(totals.fat / dayCount * 10) / 10,
    saturatedFat: Math.round(totals.saturatedFat / dayCount * 10) / 10,
    cholesterol: Math.round(totals.cholesterol / dayCount * 10) / 10,
    sodium: Math.round(totals.sodium / dayCount * 10) / 10,
    fiber: Math.round(totals.fiber / dayCount * 10) / 10,
    sugars: Math.round(totals.sugars / dayCount * 10) / 10,
    addedSugars: Math.round(totals.addedSugars / dayCount * 10) / 10,
  };
  
  return { daily: days, totals, average };
}
