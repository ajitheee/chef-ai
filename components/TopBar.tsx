import Link from "next/link";

type Section = "scaler" | "library" | "planner";

/** The dark kitchen-tablet header shared by every app screen. */
export function TopBar({ active, signOut = false }: { active: Section; signOut?: boolean }) {
  const item = (key: Section, href: string, label: string) =>
    active === key ? (
      <span className="font-medium text-white">{label}</span>
    ) : (
      <Link href={href} className="hover:text-white">
        {label}
      </Link>
    );
  return (
    <header className="no-print sticky top-0 z-40 bg-bar text-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Digital Chef AI
        </Link>
        <nav className="flex items-center gap-4 text-sm text-white/70">
          {item("scaler", "/app", "Scaler")}
          {item("library", "/library", "Library")}
          {item("planner", "/app/planner", "Planner")}
        </nav>
        {signOut && (
          <form action="/auth/signout" method="post" className="ml-auto">
            <button className="text-sm text-white/70 hover:text-white">Sign out</button>
          </form>
        )}
      </div>
    </header>
  );
}
