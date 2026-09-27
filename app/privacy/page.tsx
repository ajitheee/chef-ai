import Link from "next/link";
import { H1, H2 } from "@/components/paper";

export const metadata = {
  title: "Privacy policy · Digital Chef AI",
};

const EFFECTIVE = "26 September 2026";

/** A ruled section of the policy. */
function P({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-ink pt-3">
      <h2 className={H2}>
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Digital Chef AI
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/terms" className="text-ink-2 hover:text-ink">
              Terms
            </Link>
            <Link href="/login" className="text-ink-2 hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
        <h1 className={H1}>Privacy policy</h1>
        <p className="mt-1 text-sm text-ink-2">Effective {EFFECTIVE}. What we keep, why, and who else touches it.</p>

        <P n={1} title="Scope">
          <p>
            This policy covers Digital Chef AI (the &ldquo;Service&rdquo;), a production-scaling tool for professional kitchens. It is used by businesses; we do not knowingly collect information from anyone under 18.
          </p>
        </P>

        <P n={2} title="What we collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-semibold text-ink">Your login.</span> The email address and password of each account. Passwords are held by our sign-in provider as one-way hashes; we never see them.
            </li>
            <li>
              <span className="font-semibold text-ink">What you enter.</span> Recipes, kitchen-memory notes, verified yields, your price list, and the production sheets you generate (the most recent twenty are kept).
            </li>
            <li>
              <span className="font-semibold text-ink">Photos of recipe cards.</span> A photo you add is reduced in your browser and sent to produce the sheet. We do not store the photo.
            </li>
            <li>
              <span className="font-semibold text-ink">Technical records.</span> Our hosting provider keeps request and error logs for a short period. They contain addresses, times and error messages, not your recipes.
            </li>
          </ul>
          <p>We use no analytics, advertising or tracking services.</p>
        </P>

        <P n={3} title="Why we use it">
          <p>To run the Service: to sign you in, keep your library and sheets available on any device you sign in from, and help you when something goes wrong. Nothing else.</p>
        </P>

        <P n={4} title="Who else processes it">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-semibold text-ink">Supabase</span> stores your data and handles sign-in. Each account can read and write only its own rows.
            </li>
            <li>
              <span className="font-semibold text-ink">Vercel</span> hosts the Service and keeps the technical records above.
            </li>
            <li>
              <span className="font-semibold text-ink">Anthropic</span> is the AI provider. To produce a sheet, the recipe text or photo, the cover count and your kitchen notes are sent to it. Under its commercial terms it does not use that content to train its models.
            </li>
          </ul>
          <p>We do not sell your data, and we do not use your recipes to train AI models.</p>
        </P>

        <P n={5} title="Cookies and browser storage">
          <p>
            A session cookie keeps you signed in. Without a database connected, the Service keeps your data in your own browser instead. We set no advertising or tracking cookies.
          </p>
        </P>

        <P n={6} title="Keeping and deleting">
          <p>
            Your data stays as long as your account does. You can export it at any time (Backup) and delete recipes, notes, yields, prices and sheets in the app. To delete the account itself, ask us; provider backups may hold a copy for a limited period afterwards.
          </p>
        </P>

        <P n={7} title="Security">
          <p>
            Data travels over encrypted connections and is encrypted at rest by our providers. Database access is limited to your own login. No system is perfectly secure; keep your password private and tell us at once if you think it has been used by someone else.
          </p>
        </P>

        <P n={8} title="Changes and questions">
          <p>
            Changes are posted here with a new effective date. Questions: reply to the email that gave you your login. The <Link href="/terms" className="underline underline-offset-2 hover:text-ink">terms and conditions</Link> cover the rest of the relationship.
          </p>
        </P>
      </main>

      <footer className="border-t border-ink">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-[11px] font-bold uppercase tracking-wider text-ink-3 lg:px-8">
          <span>Digital Chef AI · Production intelligence for high-volume kitchens</span>
          <span className="flex gap-4">
            <Link href="/terms" className="underline underline-offset-2 hover:text-ink">Terms</Link>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">Privacy</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
