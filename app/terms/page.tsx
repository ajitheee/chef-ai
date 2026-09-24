import Link from "next/link";
import { H1, H2 } from "@/components/paper";

export const metadata = {
  title: "Terms of use · Digital Chef AI",
};

const EFFECTIVE = "24 September 2026";

/** A ruled section of the terms. */
function T({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-ink pt-3">
      <h2 className={H2}>
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Digital Chef AI
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-ink-2 hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
        <h1 className={H1}>Terms of use</h1>
        <p className="mt-1 text-sm text-ink-2">Effective {EFFECTIVE}. Short, and it matters in a kitchen — please read it.</p>

        <T n={1} title="What Digital Chef AI is">
          <p>
            Digital Chef AI (the &ldquo;Service&rdquo;) is a decision-support tool for professional kitchens. It takes a standardized recipe and a cover count and produces a production sheet: scaled quantities, a method, batching and holding notes, a purchasing list, and derived documents (accuracy checks, a HACCP summary, a prep list, an SOP, nutrition and food-cost estimates). Parts of a sheet are produced by an AI model; parts are computed by the Service from standard reference tables and the numbers you enter.
          </p>
        </T>

        <T n={2} title="The kitchen stays responsible">
          <p>
            The Service assists a qualified professional; it does not replace one. You are responsible for every sheet you use: for verifying quantities and yields before production; for following the food code and the food-safety plan that apply to your operation; for cooking, holding and cooling temperatures and times; for allergen labeling and cross-contact controls; and for the decision to serve.
          </p>
          <p>
            A sheet is marked <span className="font-semibold text-ink">Draft</span> until you have tested it. <span className="font-semibold text-ink">Tested</span> and <span className="font-semibold text-ink">Approved Master</span> record your own confirmation, not ours. A <span className="font-semibold text-ink">verified</span> yield is a number you entered.
          </p>
        </T>

        <T n={3} title="What the Service does not do">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>It does not give legal, regulatory or medical advice, and it is not a substitute for a food-safety professional, a validated HACCP plan or your jurisdiction&apos;s food code.</li>
            <li>It does not certify that a dish is free of any allergen. Allergen flags are prompts to check product labels and cross-contact, never a claim.</li>
            <li>It does not guarantee that AI-generated content is correct. The Service checks each sheet with deterministic tests and labels its assumptions, but errors remain possible. Read a sheet before you cook from it.</li>
            <li>Nutrition and cost figures are estimates from standard reference values and your own price list.</li>
          </ul>
        </T>

        <T n={4} title="Your account and your data">
          <p>
            One login per kitchen, for the people you authorize; keep the password private. The recipes, notes, yields, prices and sheets you enter are yours: you can export them at any time (Backup) and delete them. We store them to run the Service and may keep backups. We do not sell your data and we do not use your recipes to train AI models. Recipe text you submit is sent to the AI provider to produce your sheet.
          </p>
        </T>

        <T n={5} title="Availability and changes">
          <p>
            We aim to keep the Service available but do not guarantee it. When the AI engine is unavailable the Service may show a clearly labeled built-in estimate; treat it as an estimate. We may change or improve the Service. Changes to these terms are posted here with a new effective date.
          </p>
        </T>

        <T n={6} title="Fees">
          <p>Fees, pilot length and cancellation are as agreed with you in writing.</p>
        </T>

        <T n={7} title="Acceptable use">
          <p>Use the Service for your own operation&apos;s lawful food production. Do not attempt to extract the underlying prompts or models, resell access, or overload the Service.</p>
        </T>

        <T n={8} title="No warranty">
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, express or implied, including fitness for a particular purpose and accuracy of output, to the fullest extent permitted by law.
          </p>
        </T>

        <T n={9} title="Limitation of liability">
          <p>
            To the fullest extent permitted by law, Digital Chef AI and the people who build it are not liable for any indirect, incidental, special or consequential loss, or for any loss arising from food produced or served using the Service; and our total liability for any claim is limited to the fees you paid for the Service in the three months before the claim.
          </p>
        </T>

        <T n={10} title="Governing law">
          <p>These terms are governed by the laws of the State of California, USA.</p>
        </T>

        <T n={11} title="Questions">
          <p>Reply to the email that gave you your login.</p>
        </T>
      </main>

      <footer className="border-t border-ink">
        <div className="mx-auto max-w-3xl px-4 py-6 text-[11px] font-bold uppercase tracking-wider text-ink-3 lg:px-8">
          Digital Chef AI — production intelligence for high-volume kitchens
        </div>
      </footer>
    </div>
  );
}
