'use client';

import type { AdminPublic } from '@math-whiz/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminApiError, logout, restoreSession } from '@/lib/admin-api';

const modules = [
  { name: '会员管理' },
  { name: '试题管理' },
  { name: '答题记录' },
  { name: '年级管理', href: '/catalog' },
  { name: '奖品管理', href: '/prizes' },
];

export function Dashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminPublic>();
  const [csrfToken, setCsrfToken] = useState<string>();
  const [error, setError] = useState<string>();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    void restoreSession()
      .then((session) => {
        if (active) {
          setAdmin(session.admin);
          setCsrfToken(session.csrfToken);
        }
      })
      .catch((caught: unknown) => {
        if (!active) {
          return;
        }
        if (caught instanceof AdminApiError && caught.status === 401) {
          router.replace('/login');
          return;
        }
        setError('暂时无法加载后台，请刷新重试');
      });

    return () => {
      active = false;
    };
  }, [router]);

  const handleLogout = async () => {
    if (csrfToken === undefined) {
      return;
    }

    setLoggingOut(true);
    setError(undefined);
    try {
      await logout(csrfToken);
      setCsrfToken(undefined);
      router.replace('/login');
    } catch {
      setError('退出登录失败，请稍后重试');
      setLoggingOut(false);
    }
  };

  if (error !== undefined && admin === undefined) {
    return (
      <main className="dashboard-shell">
        <section className="status-card" role="alert">
          <h1>后台暂不可用</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (admin === undefined) {
    return (
      <main className="dashboard-shell" aria-busy="true">
        <p className="loading-state">正在验证登录状态…</p>
      </main>
    );
  }

  return (
    <div className="dashboard-layout">
      <header className="topbar">
        <div>
          <span className="brand-inline" aria-hidden="true">
            ∑
          </span>
          <strong>数学小达人管理后台</strong>
        </div>
        <div className="admin-actions">
          <span>{admin.username}</span>
          <button
            className="text-button"
            type="button"
            onClick={handleLogout}
            disabled={loggingOut || csrfToken === undefined}
          >
            {loggingOut ? '正在退出…' : '退出登录'}
          </button>
        </div>
      </header>
      <main className="dashboard-content">
        <div className="page-heading">
          <p className="eyebrow">一期管理中心</p>
          <h1>后台功能总览</h1>
          <p className="muted">管理员登录和安全会话已经就绪。</p>
        </div>
        {error === undefined ? null : (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <section className="module-grid" aria-label="管理模块">
          {modules.map((module) => (
            <article className="module-card" key={module.name}>
              <span className="module-dot" aria-hidden="true" />
              <h2>{module.name}</h2>
              {module.href === undefined ? (
                <p>将在后续一期工单中逐项开放。</p>
              ) : (
                <Link className="module-link" href={module.href}>
                  进入管理
                </Link>
              )}
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
