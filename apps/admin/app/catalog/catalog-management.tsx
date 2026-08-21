'use client';

import type { Grade, KnowledgePoint } from '@math-whiz/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  AdminApiError,
  createKnowledgePoint,
  getGrades,
  getKnowledgePoints,
  restoreSession,
  updateGrade,
  updateKnowledgePoint,
} from '@/lib/admin-api';

const statusLabel = (status: Grade['status']) =>
  status === 'ACTIVE' ? '已启用' : '已停用';

export function CatalogManagement() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string>();
  const [grades, setGrades] = useState<Grade[]>();
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>();
  const [newName, setNewName] = useState('');
  const [newGradeIds, setNewGradeIds] = useState<number[]>([]);
  const [savingKey, setSavingKey] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void restoreSession()
      .then(async (session) => {
        const [loadedGrades, loadedKnowledgePoints] = await Promise.all([
          getGrades(),
          getKnowledgePoints(),
        ]);
        if (active) {
          setCsrfToken(session.csrfToken);
          setGrades(loadedGrades);
          setKnowledgePoints(loadedKnowledgePoints);
        }
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof AdminApiError && caught.status === 401) {
          router.replace('/login');
          return;
        }
        setError('目录暂时无法加载，请刷新重试');
      });
    return () => {
      active = false;
    };
  }, [router]);

  const gradeNames = useMemo(
    () => new Map(grades?.map((grade) => [grade.id, grade.name]) ?? []),
    [grades],
  );

  const changeGrade = (gradeId: number, change: Partial<Grade>) => {
    setGrades((current) =>
      current?.map((grade) =>
        grade.id === gradeId ? { ...grade, ...change } : grade,
      ),
    );
  };

  const saveGrade = async (grade: Grade) => {
    if (csrfToken === undefined) return;
    setSavingKey(`grade-${grade.id}`);
    setError(undefined);
    setNotice(undefined);
    try {
      const saved = await updateGrade(
        grade.id,
        {
          name: grade.name,
          sortOrder: grade.sortOrder,
          status: grade.status,
        },
        csrfToken,
      );
      changeGrade(saved.id, saved);
      setNotice('年级已保存');
    } catch (caught) {
      setError(
        caught instanceof AdminApiError ? caught.message : '年级保存失败',
      );
    } finally {
      setSavingKey(undefined);
    }
  };

  const toggleNewGrade = (gradeId: number) => {
    setNewGradeIds((current) =>
      current.includes(gradeId)
        ? current.filter((id) => id !== gradeId)
        : [...current, gradeId].sort((a, b) => a - b),
    );
  };

  const addKnowledgePoint = async () => {
    if (csrfToken === undefined) return;
    setSavingKey('knowledge-point-new');
    setError(undefined);
    setNotice(undefined);
    try {
      const created = await createKnowledgePoint(
        { name: newName, gradeIds: newGradeIds },
        csrfToken,
      );
      setKnowledgePoints((current) => [...(current ?? []), created]);
      setNewName('');
      setNewGradeIds([]);
      setNotice('知识点已创建');
    } catch (caught) {
      setError(
        caught instanceof AdminApiError ? caught.message : '知识点创建失败',
      );
    } finally {
      setSavingKey(undefined);
    }
  };

  const changeKnowledgePoint = (
    knowledgePointId: string,
    change: Partial<KnowledgePoint>,
  ) => {
    setKnowledgePoints((current) =>
      current?.map((knowledgePoint) =>
        knowledgePoint.id === knowledgePointId
          ? { ...knowledgePoint, ...change }
          : knowledgePoint,
      ),
    );
  };

  const saveKnowledgePoint = async (knowledgePoint: KnowledgePoint) => {
    if (csrfToken === undefined) return;
    setSavingKey(`knowledge-point-${knowledgePoint.id}`);
    setError(undefined);
    setNotice(undefined);
    try {
      const saved = await updateKnowledgePoint(
        knowledgePoint.id,
        {
          name: knowledgePoint.name,
          status: knowledgePoint.status,
          gradeIds: knowledgePoint.gradeIds,
        },
        csrfToken,
      );
      changeKnowledgePoint(saved.id, saved);
      setNotice('知识点已保存');
    } catch (caught) {
      setError(
        caught instanceof AdminApiError ? caught.message : '知识点保存失败',
      );
    } finally {
      setSavingKey(undefined);
    }
  };

  const toggleKnowledgePointGrade = (
    knowledgePoint: KnowledgePoint,
    gradeId: number,
  ) => {
    const gradeIds = knowledgePoint.gradeIds.includes(gradeId)
      ? knowledgePoint.gradeIds.filter((id) => id !== gradeId)
      : [...knowledgePoint.gradeIds, gradeId].sort((a, b) => a - b);
    changeKnowledgePoint(knowledgePoint.id, { gradeIds });
  };

  if (grades === undefined || knowledgePoints === undefined) {
    return (
      <main className="dashboard-shell" aria-busy={error === undefined}>
        {error === undefined ? (
          <p className="loading-state">正在加载年级与知识点…</p>
        ) : (
          <section className="status-card" role="alert">
            <h1>目录暂不可用</h1>
            <p>{error}</p>
          </section>
        )}
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
          <strong>年级与知识点管理</strong>
        </div>
        <Link className="text-button" href="/dashboard">
          返回总览
        </Link>
      </header>
      <main className="dashboard-content catalog-content">
        <div className="page-heading">
          <p className="eyebrow">题库目录</p>
          <h1>年级与知识点</h1>
          <p className="muted">
            年级固定为小学一至六年级，可维护名称、排序、状态和知识点关联。
          </p>
        </div>
        {error === undefined ? null : (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice === undefined ? null : (
          <p className="success-notice" role="status">
            {notice}
          </p>
        )}

        <section className="catalog-section" aria-labelledby="grades-title">
          <h2 id="grades-title">年级</h2>
          <div className="catalog-list">
            {grades.map((grade) => (
              <fieldset
                className="catalog-row"
                key={grade.id}
                aria-label={grade.name}
              >
                <legend>{grade.id} 年级</legend>
                <label>
                  年级名称
                  <input
                    value={grade.name}
                    onChange={(event) =>
                      changeGrade(grade.id, { name: event.target.value })
                    }
                  />
                </label>
                <label>
                  排序
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={grade.sortOrder}
                    onChange={(event) =>
                      changeGrade(grade.id, {
                        sortOrder: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  状态
                  <select
                    value={grade.status}
                    onChange={(event) =>
                      changeGrade(grade.id, {
                        status: event.target.value as Grade['status'],
                      })
                    }
                  >
                    <option value="ACTIVE">已启用</option>
                    <option value="DISABLED">已停用</option>
                  </select>
                </label>
                <button
                  className="primary-button compact-button"
                  type="button"
                  disabled={savingKey === `grade-${grade.id}`}
                  onClick={() => void saveGrade(grade)}
                >
                  保存
                </button>
              </fieldset>
            ))}
          </div>
        </section>

        <section
          className="catalog-section"
          aria-labelledby="knowledge-points-title"
        >
          <h2 id="knowledge-points-title">知识点</h2>
          <div className="catalog-create-card">
            <label className="field">
              知识点名称
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
            </label>
            <div className="checkbox-grid">
              {grades.map((grade) => (
                <label key={grade.id}>
                  <input
                    type="checkbox"
                    checked={newGradeIds.includes(grade.id)}
                    onChange={() => toggleNewGrade(grade.id)}
                  />
                  适用{grade.name}
                </label>
              ))}
            </div>
            <button
              className="primary-button compact-button"
              type="button"
              disabled={
                savingKey === 'knowledge-point-new' ||
                newName.trim() === '' ||
                newGradeIds.length === 0
              }
              onClick={() => void addKnowledgePoint()}
            >
              创建知识点
            </button>
          </div>

          {knowledgePoints.length === 0 ? (
            <p className="empty-state">暂未创建知识点。</p>
          ) : null}
          <div className="catalog-list">
            {knowledgePoints.map((knowledgePoint) => (
              <fieldset
                className="catalog-row knowledge-point-row"
                key={knowledgePoint.id}
                aria-label={knowledgePoint.name}
              >
                <legend>{knowledgePoint.name}</legend>
                <label>
                  知识点名称
                  <input
                    value={knowledgePoint.name}
                    onChange={(event) =>
                      changeKnowledgePoint(knowledgePoint.id, {
                        name: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  状态
                  <select
                    value={knowledgePoint.status}
                    onChange={(event) =>
                      changeKnowledgePoint(knowledgePoint.id, {
                        status: event.target.value as KnowledgePoint['status'],
                      })
                    }
                  >
                    <option value="ACTIVE">已启用</option>
                    <option value="DISABLED">已停用</option>
                  </select>
                </label>
                <div className="checkbox-grid">
                  {grades.map((grade) => (
                    <label key={grade.id}>
                      <input
                        type="checkbox"
                        checked={knowledgePoint.gradeIds.includes(grade.id)}
                        onChange={() =>
                          toggleKnowledgePointGrade(knowledgePoint, grade.id)
                        }
                      />
                      {grade.name}
                    </label>
                  ))}
                </div>
                <p className="muted association-summary">
                  {knowledgePoint.gradeIds
                    .map((gradeId) => gradeNames.get(gradeId))
                    .filter(Boolean)
                    .join('、')}
                </p>
                <button
                  className="primary-button compact-button"
                  type="button"
                  disabled={
                    savingKey === `knowledge-point-${knowledgePoint.id}` ||
                    knowledgePoint.gradeIds.length === 0
                  }
                  onClick={() => void saveKnowledgePoint(knowledgePoint)}
                >
                  保存知识点
                </button>
                <span className="status-pill">
                  {statusLabel(knowledgePoint.status)}
                </span>
              </fieldset>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
