import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-65px)]">
      <div className="app-shell">
        <div className="card p-8 sm:p-10">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900">
            Project Status
          </h1>

          <p className="mt-3 max-w-2xl text-base text-slate-600">
            Log in to view your active projects, timelines, and send notes back to the team.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary">
              Go to login
            </Link>
            <Link href="/status" className="btn-secondary">
              Go to status
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="card-solid p-5">
              <div className="text-sm font-semibold text-slate-900">See where things stand</div>
              <div className="mt-1 text-sm text-slate-600">
                View the current status of each project at a glance.
              </div>
            </div>

            <div className="card-solid p-5">
              <div className="text-sm font-semibold text-slate-900">Send project notes</div>
              <div className="mt-1 text-sm text-slate-600">
                Share notes or requests directly with our editing team.
              </div>
            </div>

            <div className="card-solid p-5">
              <div className="text-sm font-semibold text-slate-900">Private and secure</div>
              <div className="mt-1 text-sm text-slate-600">
                Your project details and notes are kept private and secure.
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            If you have trouble logging in, confirm you’re using the email address on file.
          </div>
        </div>
      </div>
    </main>
  );
}
