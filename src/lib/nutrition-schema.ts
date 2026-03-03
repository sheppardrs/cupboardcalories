import { z } from 'zod';

export const NutritionSchema = z.object({
  brand: z.string().nullable().optional(),
  product: z.string().nullable().optional(),
  calories: z.number().nullable(),
  protein: z.number().nullable(),
  carbs: z.number().nullable(),
  fat: z.number().nullable(),
  saturatedFat: z.number().nullable(),
  sodium: z.number().nullable(),
  fiber: z.number().nullable(),
  sugars: z.number().nullable(),
  addedSugars: z.number().nullable(),
});

export type NutritionData = z.infer<typeof NutritionSchema>;

export function createOllamaFormat(): object {
  return {
    type: 'object',
    properties: {
      brand: { type: 'string', nullable: true },
      product: { type: 'string', nullable: true },
      calories: { type: 'number', nullable: true },
      protein: { type: 'number', nullable: true },
      carbs: { type: 'number', nullable: true },
      fat: { type: 'number', nullable: true },
      saturatedFat: { type: 'number', nullable: true },
      sodium: { type: 'number', nullable: true },
      fiber: { type: 'number', nullable: true },
      sugars: { type: 'number', nullable: true },
      addedSugars: { type: 'number', nullable: true },
    },
    required: [],
  };
}

export function validateNutritionData(data: unknown): NutritionData {
  return NutritionSchema.parse(data);
}

export function safeValidateNutritionData(data: unknown): { success: true; data: NutritionData } | { success: false; error: string } {
  const result = NutritionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}
