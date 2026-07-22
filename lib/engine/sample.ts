import type { ScaleInput } from "./schema";

/**
 * Sample = the chef's real Mexican Rice (Centerpointe REC03579).
 * Used to demo the full flow. The demo production sheet (demo.ts) is this
 * recipe scaled to 800 covers, so demo mode is coherent on his own food.
 */
export const SAMPLE: ScaleInput = {
  recipeText: `Mexican Rice
- 12.5 cups jasmine rice (dry)
- 1.5 cups yellow onion, diced
- 1 oz garlic, minced
- 2 oz jalapeno, minced
- 24 oz tomato puree (pizza-ready ground tomato)
- 1 #10 can fire-roasted diced tomato (with juice)
- 1 Tbsp ground cumin
- 1 tsp ground coriander
- 1 Tbsp Mexican oregano
- 1 Tbsp kosher salt
- vegetable stock (2:1 stock-to-rice by volume)
- olive/canola oil, as needed
- 1 bunch cilantro, chopped (to finish)

Method: Toast rice in oil until lightly golden. Sweat onion, then add garlic and jalapeno. Add tomato puree and diced tomato with cumin, coriander, oregano, and salt; toast the rice into it 2-3 min. Divide into 4-inch hotel pans (~4 cups mix per pan) and add vegetable stock 2:1 (8 cups stock per 4 cups mix). Cover and combi-steam at 212F for 25-30 min until tender. Fluff and fold in chopped cilantro. Hold at 135F or above.`,
  basePortions: 50,
  targetCovers: 800,
  portionSize: "3 oz cooked",
  equipment: "combi oven (steam), tilt skillet, 4-inch hotel pans",
  holdingTime: "held at 135F+ on the line, up to 2 hours",
  kitchenNotes: [],
};

/**
 * The chef's real recipe library (Centerpointe) — one-tap presets so the demo
 * runs on HIS food, not just the sample. Amounts are his standardized-recipe
 * base yields.
 */
export type Preset = {
  name: string;
  recipeText: string;
  basePortions: number;
  portionSize: string;
  equipment?: string;
  holdingTime?: string;
};

export const PRESETS: Preset[] = [
  {
    name: "Mexican Rice",
    recipeText: SAMPLE.recipeText,
    basePortions: 50,
    portionSize: "3 oz cooked",
    equipment: "combi oven (steam), tilt skillet, 4-inch hotel pans",
    holdingTime: "held at 135F+ on the line, up to 2 hours",
  },
  {
    name: "Peruvian Marinated Chicken",
    recipeText: `Peruvian Marinated Chicken
- 26 lb boneless skinless chicken breast
- 10 oz garlic, minced
- 1 lb soy sauce
- 1 lb lemon juice
- 6 oz ground cumin
- 6 oz paprika
- 2 oz black pepper
- 3 oz kosher salt
- 8 oz olive-blend oil
- 6 oz white vinegar

Method: Combine all marinade ingredients; marinate the chicken at least 4 hours (overnight best). Roast at 375F to 165F internal. Rest, then slice.`,
    basePortions: 100,
    portionSize: "4 oz cooked",
    equipment: "combi / convection oven",
    holdingTime: "held at 135F+ on the line",
  },
  {
    name: "Tomato Sauce",
    recipeText: `Tomato Sauce
- 6 #10 cans crushed tomato (fancy)
- 12 oz cane sugar
- 6 oz kosher salt
- 8 oz garlic, minced
- 12 oz extra-virgin olive oil
- 8 oz fresh basil, chiffonade

Method: Blend tomatoes smooth. Sweat garlic; add tomato, salt, and sugar; simmer 4-6 hours, reducing by ~50%. Finish with basil and olive oil.`,
    basePortions: 330,
    portionSize: "2 oz",
    equipment: "tilt skillet / steam kettle",
    holdingTime: "held at 135F+ (sauce reduces ~50%)",
  },
  {
    name: "Pinto Beans",
    recipeText: `Pinto Beans
- 1.5 cases pinto beans (canned, fancy)
- 6 oz kosher salt
- 8 oz dark chili powder
- 5 oz granulated garlic

Method: Drain and rinse beans. Warm with salt, chili powder, and garlic. Hold at 135F or above.`,
    basePortions: 75,
    portionSize: "3 oz",
    equipment: "steam kettle / tilt skillet",
    holdingTime: "held at 135F+",
  },
];
