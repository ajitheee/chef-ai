import Link from "next/link";

type Section = "scaler" | "library" | "planner";

/** The header bar shared by every app screen — paper with a black rule underneath. */
export function TopBar({ active, signOut = false }: { active: Section; signOut?: boolean }) {
  const item = (key: Section, href: string, label: string) =>
    active === key ? (
      <span className="font-medium text-bar-ink">{label}</span>
    ) : (
      <Link href={href} className="hover:text-bar-ink">
        {label}
      </Link>
    );
  return (
    <header className="no-print sticky top-0 z-40 border-b border-bar-2 bg-bar text-bar-ink">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-8">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Digital Chef AI
        </Link>
        <nav className="flex items-center gap-4 text-sm text-bar-ink/70">
          {item("scaler", "/app", "Scaler")}
          {item("library", "/library", "Library")}
          {item("planner", "/app/planner", "Planner")}
        </nav>
        {signOut && (
          <form action="/auth/signout" method="post" className="ml-auto">
            <button className="text-sm text-bar-ink/70 hover:text-bar-ink">Sign out</button>
          </form>
        )}
      </div>
    </header>
  );
}
