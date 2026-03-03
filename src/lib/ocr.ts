export interface ExtractedNutrition {
  brand?: string;
  product?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  saturatedFat?: number;
  sodium?: number;
  fiber?: number;
  sugars?: number;
  addedSugars?: number;
}

export async function processNutritionLabel(imageSource: string | File): Promise<{ text: string; nutrition: ExtractedNutrition }> {
  const formData = new FormData();
  
  if (typeof imageSource === 'string') {
    const response = await fetch(imageSource);
    const blob = await response.blob();
    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
    formData.append('image', file);
  } else {
    formData.append('image', imageSource);
  }
  
  const response = await fetch('http://localhost:5000/extract', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Server error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Extraction failed');
  }
  
  return {
    text: data.raw || 'Extracted via local VLM',
    nutrition: data.nutrition,
  };
}
