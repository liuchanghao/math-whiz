'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { AdminApiError, login } from '@/lib/admin-api';

export function LoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);

    const form = new FormData(event.currentTarget);
    try {
      await login({
        username: String(form.get('username') ?? ''),
        password: String(form.get('password') ?? ''),
      });
      router.replace('/dashboard');
    } catch (caught) {
      setError(
        caught instanceof AdminApiError
          ? caught.message
          : '暂时无法登录，请稍后重试',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="username">管理员账号</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          minLength={3}
          maxLength={64}
          required
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="password">密码</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={256}
          required
        />
      </div>
      {error === undefined ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button" type="submit" disabled={submitting}>
        {submitting ? '正在登录…' : '登录后台'}
      </button>
    </form>
  );
}
