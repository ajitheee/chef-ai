import { z } from "zod";

/** ---------- INPUT ---------- */
export const ImageInputSchema = z.object({
  dataBase64: z.string().min(1),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
});
export type ImageInput = z.infer<typeof ImageInputSchema>;

export const ScaleInputSchema = z
  .object({
    recipeText: z.string().optional().default(""),
    basePortions: z.number().positive("Base portions must be > 0."),
    targetCovers: z.number().positive("Target covers must be > 0."),
    portionSize: z.string().min(1, "Enter a portion size (e.g. 10 oz)."),
    equipment: z.string().optional().default(""),
    holdingTime: z.string().optional().default(""),
    image: ImageInputSchema.optional(),
    kitchenNotes: z.array(z.string()).optional().default([]),
  })
  .refine((v) => (v.recipeText && v.recipeText.trim().length > 0) || !!v.image, {
    message: "Provide a recipe (text) or a photo of one.",
    path: ["recipeText"],
  });
export type ScaleInput = z.infer<typeof ScaleInputSchema>;

/** ---------- OUTPUT (the Structured Recipe / Production Sheet) ---------- */
export const IngredientSchema = z.object({
  item: z.string(),
  scaledQty: z.string(),
  unit: z.string().optional().default(""),
  role: z.string().optional().default(""),
  baseQty: z.string().optional().default(""),
  multiplier: z.string().optional().default(""),
  note: z.string().optional().default(""),
});
export type Ingredient = z.infer<typeof IngredientSchema>;

export const PullItemSchema = z.object({
  item: z.string(),
  apQty: z.string(),
  note: z.string().optional().default(""),
});
export type PullItem = z.infer<typeof PullItemSchema>;

export const ProductionSheetSchema = z.object({
  dish: z.string(),
  mode: z.string().optional().default("savory"),
  baseYield: z.object({
    portions: z.number(),
    portionSize: z.string(),
  }),
  targetYield: z.object({
    covers: z.number(),
    portionSize: z.string(),
    finishedYield: z.string(),
  }),
  assumptions: z.array(z.string()).optional().default([]),
  ingredients: z.array(IngredientSchema),
  method: z.array(z.string()).optional().default([]),
  batching: z.array(z.string()).optional().default([]),
  holding: z.array(z.string()).optional().default([]),
  pullList: z.array(PullItemSchema).optional().default([]),
  safetyFlags: z.array(z.string()).optional().default([]),
  allergenFlags: z.array(z.string()).optional().default([]),
});
export type ProductionSheet = z.infer<typeof ProductionSheetSchema>;

/**
 * JSON Schema handed to Claude as a tool, so the model is forced to return
 * structured data that matches ProductionSheetSchema above.
 */
export const PRODUCTION_SHEET_JSON_SCHEMA = {
  type: "object",
  properties: {
    dish: { type: "string", description: "Recipe / dish name." },
    mode: { type: "string", enum: ["savory", "baking", "safety_chemistry"] },
    baseYield: {
      type: "object",
      properties: {
        portions: { type: "number" },
        portionSize: { type: "string" },
      },
      required: ["portions", "portionSize"],
    },
    targetYield: {
      type: "object",
      properties: {
        covers: { type: "number" },
        portionSize: { type: "string" },
        finishedYield: { type: "string", description: "Total finished edible weight, e.g. '531 lb'." },
      },
      required: ["covers", "portionSize", "finishedYield"],
    },
    assumptions: {
      type: "array",
      items: { type: "string" },
      description: "Every assumption made (yield %, buffer, etc.). Be explicit.",
    },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          scaledQty: { type: "string", description: "Scaled amount, e.g. '136 lb'." },
          unit: { type: "string" },
          role: {
            type: "string",
            description: "structural | flavor_base | high_impact | binder | fat | finishing | functional",
          },
          baseQty: { type: "string", description: "Original amount in the base recipe." },
          multiplier: { type: "string", description: "Effective multiplier, e.g. 'x11 (dampened)'." },
          note: { type: "string", description: "One-line reason for non-linear scaling, if any." },
        },
        required: ["item", "scaledQty"],
      },
    },
    method: { type: "array", items: { type: "string" } },
    batching: {
      type: "array",
      items: { type: "string" },
      description: "Batching instructions when volume exceeds vessel/equipment capacity.",
    },
    holding: {
      type: "array",
      items: { type: "string" },
      description: "Hot-line holding adjustments (starch absorption, tightening, seasoning drift, etc.).",
    },
    pullList: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          apQty: { type: "string", description: "As-purchased raw quantity to requisition." },
          note: { type: "string" },
        },
        required: ["item", "apQty"],
      },
    },
    safetyFlags: {
      type: "array",
      items: { type: "string" },
      description: "Food-safety + cooling notes; never improvise safety-critical numbers.",
    },
    allergenFlags: {
      type: "array",
      items: { type: "string" },
      description: "Major allergens present (milk, egg, fish, shellfish, tree nut, peanut, wheat/gluten, soy, sesame). Never claim allergen-free without known controls.",
    },
  },
  required: ["dish", "baseYield", "targetYield", "ingredients"],
} as const;

/** ---------- VARIATIONS (the creative lens) ---------- */
export const VariationsInputSchema = z
  .object({
    dish: z.string().optional().default(""),
    recipeText: z.string().optional().default(""),
    portionSize: z.string().optional().default("3 oz cooked"),
    equipment: z.string().optional().default(""),
  })
  .refine((v) => (v.dish && v.dish.trim()) || (v.recipeText && v.recipeText.trim()), {
    message: "Give a dish name or a recipe to riff on.",
    path: ["dish"],
  });
export type VariationsInput = z.infer<typeof VariationsInputSchema>;

export const VariationSchema = z.object({
  name: z.string(),
  summary: z.string(),
  recipeText: z.string(),
  basePortions: z.number().positive(),
  portionSize: z.string(),
  tags: z.array(z.string()).optional().default([]),
});
export type Variation = z.infer<typeof VariationSchema>;

export const VariationsResultSchema = z.object({
  dish: z.string(),
  variations: z.array(VariationSchema),
});
export type VariationsResult = z.infer<typeof VariationsResultSchema>;

export const VARIATIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    dish: { type: "string" },
    variations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Variation name." },
          summary: { type: "string", description: "One line: what changes and why." },
          recipeText: { type: "string", description: "Complete ingredient list + brief method for this version." },
          basePortions: { type: "number" },
          portionSize: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["name", "summary", "recipeText", "basePortions", "portionSize"],
      },
    },
  },
  required: ["dish", "variations"],
} as const;
