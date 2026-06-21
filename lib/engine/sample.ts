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
