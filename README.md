# Client Updates Portal — v2.2 (Stable)

A client-facing project status portal built with Next.js and Supabase authentication, deployed on Vercel.

This is the **v2.2 stable release** and is intended for production use.

---

## Features

- Passwordless client login (magic link)
- Allowlist-gated login requests (only approved emails can request a link)
- Secure authenticated portal
- Responsive UI
  - Desktop: table layout
  - Mobile: portrait-friendly card layout (no horizontal scrolling)

---

## Tech Stack

- Next.js (App Router)
- Supabase Auth
- Tailwind CSS
- Vercel

---

## Getting Started (Local)

Install dependencies and run:

```bash
npm install
npm run dev
