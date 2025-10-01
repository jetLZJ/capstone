import { Link } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';

const UnauthorizedPage = () => {
  return (
    <div className="min-h-[70vh] bg-[var(--app-bg)] py-16">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(15,23,42,0.08)] text-[var(--app-primary)]">
          <FiLock className="text-2xl" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-[var(--app-text)]">Access Restricted</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--app-muted)]">
          You don&apos;t have permission to view this page. If you believe this is a mistake, please contact an administrator or try a different section of the app.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-[var(--app-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90"
          >
            Go to Dashboard
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-full border border-[rgba(15,23,42,0.12)] px-5 py-2.5 text-sm font-semibold text-[var(--app-text)] hover:border-[var(--app-primary)]"
          >
            Switch Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
