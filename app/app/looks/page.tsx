import Link from "next/link";
import { LOOKS } from "@/components/looks/looks";

export const metadata = { title: "Three looks · Digital Chef AI" };

/** The chooser: three directions, each a real screen on the chef's Mexican Rice. */
export default function LooksIndex() {
  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <main className="mx-auto max-w-3xl px-5 py-12">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Digital Chef AI</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Three looks for the same sheet.</h1>
        <p className="mt-3 text-[#4b5563]">Open each one on your phone. Change the covers, tap around. Pick one, or say what to take from each.</p>
        <ol className="mt-8 space-y-3">
          {LOOKS.map((l, n) => (
            <li key={l.id}>
              <Link href={`/app/looks/${l.id}`} className="flex items-center gap-5 rounded-2xl border border-[#e5e7eb] p-5 transition hover:border-[#111827]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-lg font-bold text-white">{String.fromCharCode(65 + n)}</span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold">{l.name}</span>
                  <span className="block text-sm text-[#4b5563]">{l.idea}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-xs text-[#6b7280]">Every number is the real Mexican Rice card scaled by the built-in estimate, so the looks can be compared without the engine. The chosen look becomes the app.</p>
      </main>
    </div>
  );
}
