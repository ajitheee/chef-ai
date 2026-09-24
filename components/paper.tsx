import type { ReactNode } from "react";

/* ---------- The paper look, shared by every app screen ----------
   Underlined white fields, small-caps labels, outlined chips (filled black when
   active), one black action button, and rules instead of boxes. */

/** Page container: uses a wide screen (1600px) but stays readable. */
export const PAGE = "mx-auto max-w-[100rem] px-4 py-6 lg:px-8";
/** The scaler/planner shape: a sticky left pane and a ruled document on the right. */
export const TWO_PANE = "mx-auto max-w-[100rem] px-4 py-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10 lg:px-8 print:block";
export const PANE_LEFT = "no-print lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:pb-6 lg:pr-1";
export const PANE_RIGHT = "mt-8 min-w-0 lg:mt-0 lg:border-l lg:border-ink lg:pl-10 print:mt-0 print:border-0 print:pl-0";

export const H1 = "text-xl font-semibold tracking-tight";
export const H2 = "text-[11px] font-bold uppercase tracking-wider text-ink";
export const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-3";
export const LABEL_INLINE = "mr-1 text-[11px] font-bold uppercase tracking-wider text-ink-3";

export const FIELD =
  "w-full border-b border-ink bg-card px-3 py-2.5 text-base text-ink placeholder:text-ink-3 focus:outline-none focus:shadow-[0_1px_0_0_var(--color-ink)]";
export const FIELD_ERR = FIELD.replace("border-ink bg-card", "border-danger bg-danger-soft").replace("placeholder:text-ink-3", "placeholder:text-danger");
/** A field, red when it is the one that needs filling in. */
export const fieldCls = (err: boolean) => (err ? FIELD_ERR : FIELD);

export const CHIP = "rounded-md border border-ink px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft";
export const CHIP_ON = "rounded-md border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-card";
/** An outlined chip, filled black when it is the active choice. */
export const chip = (on: boolean) => (on ? CHIP_ON : CHIP);
export const PRIMARY = "rounded-md bg-accent font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50";

/** Table cells: a black rule under the header, hairlines between rows. */
export const TH = "border-b border-ink py-1.5 pr-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-3";
export const TD = "border-b border-line py-2 pr-3 align-top";

/** Notes in the margin: a colored rule on the left, never a box. */
export const NOTE_WARN = "border-l-4 border-warn bg-warn-soft px-3 py-2 text-sm";
export const NOTE_DANGER = "border-l-4 border-danger bg-danger-soft px-3 py-2 text-sm font-semibold text-danger";
export const NOTE_INFO = "border-l-4 border-ink bg-accent-soft px-3 py-2 text-sm";

/** A ruled section: a rule, a small-caps title (with an optional right-hand note), then the content. */
export function Section({ title, aside, className, children }: { title: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`mt-6 border-t border-ink pt-3 ${className || ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={H2}>{title}</h3>
        {aside}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** A square status marker (black = fine, red = look). */
export function Dot({ cls }: { cls: string }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-[1px] ${cls}`} />;
}
