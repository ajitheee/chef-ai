import type { ScaleInput } from "./schema";

/**
 * Sample dining-hall recipe for testing the engine before the chef's real
 * recipes are loaded. Swap these for his actual recipes once available.
 */
export const SAMPLE: ScaleInput = {
  recipeText: `Chicken & Andouille Jambalaya
- 8 lb boneless chicken thigh, diced
- 4 lb andouille sausage, sliced
- 6 lb long-grain rice (dry)
- 1.5 gal chicken stock
- 3 lb yellow onion, diced
- 2 lb green bell pepper, diced
- 1.5 lb celery, diced
- 4 oz garlic, minced
- 1 #10 can diced tomato
- 1 cup Cajun seasoning
- salt to taste
- oil as needed
- green onion & parsley to finish

Method: Brown chicken and sausage. Sweat onion, pepper, celery, garlic. Add tomato, Cajun seasoning, rice and stock. Simmer covered until rice is tender. Rest, fluff, finish with green onion and parsley.`,
  basePortions: 50,
  targetCovers: 850,
  portionSize: "10 oz",
  equipment: "tilt skillet, combi oven, 40-gal kettle",
  holdingTime: "up to 2 hours on the hot line",
};
