/**
 * Ask check: the scaler's front door sends each line to the right place. No API
 * calls. Run: `npm run ask:check`.
 */
import { parseAsk, routeAsk } from "../lib/ask";

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
}

const library = [{ name: "Mexican Rice" }, { name: "Spanish Rice" }, { name: "Chicken Piccata" }, { name: "Pork Al Pastor" }];
const route = (t: string, lib = library) => routeAsk(t, lib);
const describe = (r: ReturnType<typeof route>) =>
  r.kind === "scale" ? `scale ${r.recipe.name} ${r.covers}` : r.kind === "choose" ? `choose ${r.matches.map((m) => m.name).join("|")} ${r.covers}` : r.kind === "covers" ? `covers ${r.covers}` : "brain";

// A library recipe and a count scale straight away, however the line is put.
for (const line of ["Mexican rice for 800", "mexican rice 800", "800 mexican rice", "Scale the Mexican Rice to 800 covers", "MEXICAN RICE x 800", "Mexican Rice for 800 people tonight"]) {
  check(`"${line}" scales Mexican Rice for 800`, describe(route(line)) === "scale Mexican Rice 800", describe(route(line)));
}
check("a comma in the count is fine", describe(route("Chicken Piccata for 1,200")) === "scale Chicken Piccata 1200", describe(route("Chicken Piccata for 1,200")));
check("a quantity with a unit is not the count", describe(route("mexican rice 4 oz for 800")) === "scale Mexican Rice 800", describe(route("mexican rice 4 oz for 800")));
check("a glued unit is not the count", parseAsk("rice 4oz for 800").covers === 800);

// Several recipes fit: the chef picks.
check("one word that fits two recipes becomes a choice", describe(route("rice for 800")) === "choose Mexican Rice|Spanish Rice 800", describe(route("rice for 800")));
check("the exact name beats the wider match", describe(route("mexican rice for 800", [{ name: "Mexican Rice" }, { name: "Mexican Rice Bowl" }])) === "scale Mexican Rice 800");
check("the same name twice is one match", describe(route("mexican rice for 800", [{ name: "Mexican Rice" }, { name: "mexican rice" }])) === "scale Mexican Rice 800");

// Everything else goes to Kitchen Brain.
check("a dish not in the library goes to the brain", describe(route("chicken tinga for 120")) === "brain");
check("a question goes to the brain", describe(route("what is in my library?")) === "brain");
check("a problem with a count still goes to the brain", describe(route("my rice came out gummy at 800 covers")) === "brain");
check("no count goes to the brain", describe(route("mexican rice")) === "brain");
check("a pasted card goes to the brain", describe(route("Chicken Tinga\n- 16 lb chicken thighs\n- 6 lb onion")) === "brain");
check("an empty line goes nowhere useful", route("   ").kind === "brain");

// Only a number: set the count, ask for the recipe.
check("a bare count is a count", describe(route("800")) === "covers 800");
check("a count with filler is a count", describe(route("for 800 covers")) === "covers 800");

// The parser itself.
const p = parseAsk("Scale the Mexican Rice to 1,200 covers please");
check("parser strips the small words", p.words.join(" ") === "mexican rice" && p.covers === 1200, `${p.words.join(" ")} / ${p.covers}`);
check("the last count on the line wins", parseAsk("mexican rice 50 for 800").covers === 800);
check("a huge number is not a count", parseAsk("rice for 1000000").covers === null);

console.log("");
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
