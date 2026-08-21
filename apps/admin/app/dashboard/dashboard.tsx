'use client';

import type { AdminPublic } from '@math-whiz/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminApiError, logout, restoreSession } from '@/lib/admin-api';

const modules = [
  { name: '会员管理', description: '维护会员账号与启停状态' },
  { name: '试题管理', description: '维护数学题、答案与解析' },
  { name: '答题记录', description: '查看会员作答与答题报告' },
  {
    name: '年级管理',
    description: '配置年级、排序与知识点关联',
    href: '/catalog',
  },
  {
    name: '奖品管理',
    description: '维护实物奖品与年级当前奖品',
    href: '/prizes',
  },
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
          <h1>后台功能总览</h1>
          <p className="muted">
            选择一个已开放模块开始维护，其他一期能力将按工单逐步上线。
          </p>
        </div>
        {error === undefined ? null : (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <section className="module-board" aria-label="管理模块">
          <div className="available-modules">
            <div className="section-heading">
              <h2>当前可用</h2>
              <span>
                {modules.filter((module) => module.href).length} 个模块
              </span>
            </div>
            <div className="module-list">
              {modules
                .filter((module) => module.href)
                .map((module) => (
                  <Link
                    className="module-row module-row-active"
                    href={module.href ?? '/dashboard'}
                    key={module.name}
                  >
                    <span>
                      <strong>{module.name}</strong>
                      <small>{module.description}</small>
                    </span>
                    <span className="module-link">进入管理</span>
                  </Link>
                ))}
            </div>
          </div>
          <div className="upcoming-modules">
            <div className="section-heading">
              <h2>后续开放</h2>
              <span>一期计划</span>
            </div>
            <ul>
              {modules
                .filter((module) => module.href === undefined)
                .map((module) => (
                  <li key={module.name}>
                    <span>
                      <strong>{module.name}</strong>
                      <small>{module.description}</small>
                    </span>
                    <span className="status-pill">待开放</span>
                  </li>
                ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
