React Frontend
===============

Single-page application built with React and Vite that powers the Capstone dashboard, menu tooling, scheduling planner, and analytics UI.

Tech Stack
----------

- **Runtime & Bundler:** Node.js 18+, Vite
- **Framework:** React 18 with Hooks and Context API
- **Routing:** React Router (client-side routing, protected routes)
- **Styling:** TailwindCSS utility classes + custom CSS variables
- **State/Data:** Custom hooks, browser storage for JWTs, fetch helpers (Axios-alike in `utils/httpClient.js`)
- **Testing:** Vitest, React Testing Library
- **Build:** `npm run build` produces optimized assets for nginx or any static host

Project Layout
--------------

```text
react/
├── src/
│   ├── components/
│   │   ├── analytics/          # Revenue & staffing visualisations
│   │   ├── auth/               # Login/Register UI, protected routing
│   │   ├── dashboard/          # Role-specific dashboards (Admin/Manager/Staff)
│   │   ├── menu/               # Menu editor, grid, sidebar, availability toggles
│   │   ├── orders/             # Active order panel, history list
│   │   ├── schedule/           # Drag & drop calendar, availability widgets
│   │   └── shared/ui           # Layout, header, loading states
│   ├── context/AuthContext.jsx # JWT storage, profile caching, role helpers
│   ├── hooks/                  # Data fetching (orders, auth), utilities
│   ├── pages/                  # Route containers (Home, Login, Menu, Schedule, Analytics, Orders)
│   ├── services/               # API clients (AuthService, MenuService, TypesService)
│   └── utils/                  # HTTP client, formatting helpers
├── public/                     # Static assets (favicon, branding)
├── vite.config.js              # Vite configuration (proxy to Flask API)
├── tailwind.config.js          # Tailwind theme tokens
└── package.json                # Scripts and dependencies
```

Local Development
-----------------

```powershell
cd react
npm install
npm run dev   # localhost:5173 (see proxy rules in vite.config.js)
```

- Ensure the Flask API runs on `http://localhost:5000` when developing without Docker; Vite proxies `/api` requests.
- Environment variables live in `.env.local` (optional). Common ones include `VITE_API_BASE_URL` if you target a different backend.
- Tailwind config is dynamic; restart `npm run dev` when editing `tailwind.config.js`.

Available Scripts
-----------------

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with HMR and proxy. |
| `npm run build` | Production build (outputs to `dist/`). |
| `npm run preview` | Serve the `dist/` build locally. |
| `npm run lint` | ESLint + formatting checks. |
| `npm run test` | Run unit/component tests via Vitest. |

Architecture Notes
------------------

- **Routing:** `src/App.jsx` defines routes guarded by `ProtectedRoute.jsx`. Role-based access (Admin/Manager/Staff/User) pulls from `AuthContext`.
- **Authentication:** Tokens stored via `AuthContext` helpers and `AuthService`. Refresh token support is available through backend `/api/auth/refresh`.
- **Scheduling:** Drag-and-drop interactions handled in `schedule/ScheduleCalendar.jsx` plus helper utilities.
- **Analytics:** `components/analytics/AnalyticsSummary.jsx` renders cards and charts backed by `/api/analytics/summary`.
- **Orders:** Customer dashboards use `useCustomerOrder` and `useOrderHistory` hooks to keep active orders and history in sync.

Testing & QA
------------

```powershell
npm run test        # Vitest tests
npm run lint        # ESLint + Tailwind class checks
npm run build       # Ensure production build succeeds
```

Vitest configuration lives inline (Vite default). Component tests reside under `src/components/**/__tests__`.

Deployment
----------

1. Build the static bundle: `npm run build`.
2. Serve `dist/` via nginx (see project `proxy/`), static hosting (Netlify, Vercel), or integrate into a Docker image.
3. Ensure the runtime environment provides `VITE_API_BASE_URL` or relies on nginx reverse proxying `/api` to the Flask service.

Troubleshooting
---------------

- **API 401s:** Confirm JWT tokens are present in local storage and that the backend URL matches the proxy target.
- **Tailwind classes missing:** The project uses JIT mode; verify class names are static strings or add safelist entries in `tailwind.config.js`.
- **Drag-and-drop lag:** Running without the backend may limit data; seed the database (`python flask/seed_data.py`) for realistic fixtures.

For backend integration details, see [`../flask/README.md`](../flask/README.md) and the root project guide in [`../README.md`](../README.md).
