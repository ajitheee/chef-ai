/** The three directions, by id. Plain data, importable from server and client code alike. */
export const LOOKS = [
  { id: "line", name: "Line", idea: "A kitchen display. Dark, big numbers, stations you tap through at arm's length." },
  { id: "brain", name: "Brain", idea: "The AI first. You say what you are cooking; the sheet arrives in the conversation." },
  { id: "board", name: "Board", idea: "A visual app. Slide the covers; the chef's numbers sit against the calculator's on every row." },
] as const;
export type LookId = (typeof LOOKS)[number]["id"];
