// src/app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <header className="flex flex-col gap-3">
          <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">
            Client Updates
          </h1>
          <p className="max-w-2xl text-lg text-slate-700">
            Log in to view your project status, due dates, and notes.
          </p>
        </header>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">What you’ll see</div>
              <p className="mt-2 text-slate-700">
                A clean status dashboard with your project summary and a checklist of tasks, dates,
                and progress—always up to date.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Project summary</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Name, next due date, last update
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Task table</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Status pills and completion dates
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Notes</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Clear, client-safe updates
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Links</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Deliverables, docs, next steps
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-semibold text-slate-900">Client login</div>
              <p className="mt-2 text-sm text-slate-700">
                Use your email to receive a secure magic link.
              </p>

              <Link
                href="/login"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Go to Login
              </Link>

              <div className="mt-4 text-xs text-slate-500">
                If you don’t receive an email within a minute, check spam the first time.
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 text-xs text-slate-500">
          © {new Date().getFullYear()} Client Updates Portal
        </footer>
      </div>
    </main>
  );
}
