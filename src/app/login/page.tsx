import type { Metadata } from 'next';
import { sanitizeNext } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in · Birrwise',
  robots: { index: false, follow: false },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const rawNext = Array.isArray(searchParams?.next)
    ? searchParams?.next[0]
    : searchParams?.next;

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">b.</div>
          <span>birrwise</span>
        </div>
        <h1>Welcome back</h1>
        <p className="login-sub">Sign in to your private finance workspace.</p>
        <LoginForm next={sanitizeNext(rawNext)} />
        <p className="login-note">
          🔒 Your money. Your data. Nothing is shared.
        </p>
      </div>
    </div>
  );
}
