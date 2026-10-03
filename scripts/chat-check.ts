/**
 * Chat check: the blocks Kitchen Brain writes (RECIPE CARD, CHOICES) read back
 * the way the page expects, including while they stream, and the contract
 * carries both formats. No API calls. Run: `npm run chat:check`.
 */
import { splitBlocks, parseChoices, hidePartialChoices, MAX_CHOICES } from "../lib/recipe-card";
import { demoReplyText } from "../lib/engine/chat";
import { CHAT_CONTRACT } from "../lib/engine/brain/chat-contract";

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
}
const kinds = (text: string) => splitBlocks(text).map((s) => s.kind).join(",");

// The demo reply: text, a card, text, then a gate with one option.
const demo = splitBlocks(demoReplyText());
check("demo reply is text, card, text, choices", kinds(demoReplyText()) === "text,card,text,choices", kinds(demoReplyText()));
const gate = demo.find((s) => s.kind === "choices");
check(
  "demo gate offers exactly one scale option",
  gate?.kind === "choices" && gate.choices.options.length === 1 && /^Scale it for \d+ covers$/.test(gate.choices.options[0]),
  gate?.kind === "choices" ? gate.choices.options.join("|") : "no gate"
);
check("demo gate has its question", gate?.kind === "choices" && gate.choices.question === "Scale this card as it is?");
check("pressing the demo gate gets a follow-up without a card", kinds(demoReplyText("Scale it for 800 covers")) === "text");
check("the follow-up names the count", /800 covers/.test(demoReplyText("Scale it for 800 covers")));
check("the follow-up also answers the approve-and-scale wording", kinds(demoReplyText("Approve and scale it for 800 covers")) === "text");

// Reading a CHOICES body.
const q1 = parseChoices("Question: Which equipment will you use?\n- Tilt skillet\n- Steam kettle\n");
check("question with the prefix, hyphen options", q1?.question === "Which equipment will you use?" && q1.options.join("|") === "Tilt skillet|Steam kettle");
const q2 = parseChoices("Keep the cilantro?\n1. Keep it\n2) Leave it out");
check("question without the prefix, numbered options", q2?.question === "Keep the cilantro?" && q2.options.join("|") === "Keep it|Leave it out");
check("no options is not a block", parseChoices("Question: How many covers?") === null);
check("duplicate options collapse", parseChoices("- Yes\n- yes\n- No")?.options.length === 2);
check(`more than ${MAX_CHOICES} options are cut to ${MAX_CHOICES}`, parseChoices("- A\n- B\n- C\n- D\n- E\n- F")?.options.length === MAX_CHOICES);
check("a stray line after the options is ignored", parseChoices("Q?\n- A\nthanks")?.options.join("|") === "A");
check("the question keeps its dash for the page to normalize", parseChoices("Q — really?\n- A")?.question === "Q — really?");

// Streaming: a block without its end is text, and is held back until it ends.
const partial = "Here is the card.\n\nCHOICES\nQuestion: Scale it?\n- Scale it for 120";
check("a block without its end stays text", kinds(partial) === "text");
check("a half-written block is hidden while streaming", hidePartialChoices(partial) === "Here is the card.");
check("a bare CHOICES line is hidden too", hidePartialChoices("Done.\n\nCHOICES") === "Done.");
const whole = `${partial} covers\nEND CHOICES`;
check("a finished block is not hidden", hidePartialChoices(whole) === whole);
check("a finished block becomes choices", kinds(whole) === "text,choices");
check("text with no block is untouched", hidePartialChoices("plain") === "plain");

// Order and separation.
const both = "Intro\n\nCHOICES\nQ?\n- A\nEND CHOICES\n\nmid\n\nRECIPE CARD\nName: X\nBase portions: 10\nPortion size: 4 oz\nINGREDIENTS\n- 1 lb x\nMETHOD\n1. cook\nEND CARD\n\ntail";
check("blocks keep their order", kinds(both) === "text,choices,text,card,text", kinds(both));
check("blank lines around blocks are not segments", splitBlocks(both).every((s) => s.kind !== "text" || (s.text.trim() && !s.text.startsWith("\n") && !s.text.endsWith("\n"))));
check("END CHOICES never opens a block", kinds("x\nEND CHOICES\nmore\nEND CHOICES") === "text");
check("a card followed only by a gate has no empty text between", kinds("RECIPE CARD\nName: X\nINGREDIENTS\n- 1 lb x\nEND CARD\n\nCHOICES\nQ?\n- A\nEND CHOICES") === "card,choices");

// The contract the model writes under.
check("contract carries the CHOICES format", /^CHOICES\n[\s\S]*?^END CHOICES/m.test(CHAT_CONTRACT));
check("contract gates scaling a conversation card", /never scale it in the same turn/.test(CHAT_CONTRACT));
check("contract names the gate option", /"Scale it for N covers"/.test(CHAT_CONTRACT));

console.log("");
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
