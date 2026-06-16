import type { ProductionSheet } from "./engine/schema";

// A "lens" on the production object — text/CSV views. No new data model.

function csvCell(s: string): string {
  const v = s ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function pullListCsv(sheet: ProductionSheet): string {
  const rows: string[][] = [["Item", "Quantity (AP)", "Note"]];
  for (const it of sheet.pullList) rows.push([it.item, it.apQty, it.note || ""]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function sheetText(sheet: ProductionSheet): string {
  const L: string[] = [];
  L.push(sheet.dish);
  L.push(
    `${sheet.baseYield.portions} portions -> ${sheet.targetYield.covers} covers @ ${sheet.targetYield.portionSize} (finished: ${sheet.targetYield.finishedYield})`
  );
  L.push("", "SCALED RECIPE");
  for (const ing of sheet.ingredients) {
    L.push(
      `- ${ing.item}: ${ing.scaledQty}${ing.multiplier ? `  [${ing.multiplier}]` : ""}${ing.note ? ` - ${ing.note}` : ""}`
    );
  }
  if (sheet.batching.length) {
    L.push("", "BATCHING");
    sheet.batching.forEach((b) => L.push(`- ${b}`));
  }
  if (sheet.holding.length) {
    L.push("", "HOLDING");
    sheet.holding.forEach((b) => L.push(`- ${b}`));
  }
  if (sheet.pullList.length) {
    L.push("", "PULL LIST");
    sheet.pullList.forEach((p) => L.push(`- ${p.item}: ${p.apQty}${p.note ? ` (${p.note})` : ""}`));
  }
  if (sheet.assumptions.length) {
    L.push("", "ASSUMPTIONS");
    sheet.assumptions.forEach((a) => L.push(`- ${a}`));
  }
  if (sheet.allergenFlags.length) {
    L.push("", "ALLERGEN FLAGS");
    sheet.allergenFlags.forEach((s) => L.push(`- ${s}`));
  }
  if (sheet.safetyFlags.length) {
    L.push("", "SAFETY & COOLING");
    sheet.safetyFlags.forEach((s) => L.push(`- ${s}`));
  }
  return L.join("\n");
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function safeFileName(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "production";
}
