'use client';

import type { Grade, Prize } from '@math-whiz/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  AdminApiError,
  createPrize,
  getGrades,
  getPrizes,
  restoreSession,
  setGradeCurrentPrize,
  setPrizeEnabled,
  updatePrize,
} from '@/lib/admin-api';

const emptyPrize = {
  name: '',
  description: '',
  claimInstructions: '',
  gradeIds: [] as number[],
};

export function PrizeManagement() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string>();
  const [grades, setGrades] = useState<Grade[]>();
  const [prizes, setPrizes] = useState<Prize[]>();
  const [draft, setDraft] = useState(emptyPrize);
  const [savingKey, setSavingKey] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void restoreSession()
      .then(async (session) => {
        const [loadedGrades, loadedPrizes] = await Promise.all([
          getGrades(),
          getPrizes(),
        ]);
        if (active) {
          setCsrfToken(session.csrfToken);
          setGrades(loadedGrades);
          setPrizes(loadedPrizes);
        }
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof AdminApiError && caught.status === 401) {
          router.replace('/login');
          return;
        }
        setError('奖品数据暂时无法加载，请刷新重试');
      });
    return () => {
      active = false;
    };
  }, [router]);

  const toggleDraftGrade = (gradeId: number) => {
    setDraft((current) => ({
      ...current,
      gradeIds: current.gradeIds.includes(gradeId)
        ? current.gradeIds.filter((id) => id !== gradeId)
        : [...current.gradeIds, gradeId].sort((a, b) => a - b),
    }));
  };

  const changePrize = (prizeId: string, change: Partial<Prize>) => {
    setPrizes((current) =>
      current?.map((prize) =>
        prize.id === prizeId ? { ...prize, ...change } : prize,
      ),
    );
  };

  const togglePrizeGrade = (prize: Prize, gradeId: number) => {
    changePrize(prize.id, {
      gradeIds: prize.gradeIds.includes(gradeId)
        ? prize.gradeIds.filter((id) => id !== gradeId)
        : [...prize.gradeIds, gradeId].sort((a, b) => a - b),
    });
  };

  const runSave = async (key: string, operation: () => Promise<void>) => {
    setSavingKey(key);
    setError(undefined);
    setNotice(undefined);
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof AdminApiError ? caught.message : '操作失败');
    } finally {
      setSavingKey(undefined);
    }
  };

  const addPrize = async () => {
    if (csrfToken === undefined) return;
    await runSave('new', async () => {
      const created = await createPrize(draft, csrfToken);
      setPrizes([created, ...(prizes ?? [])]);
      setDraft(emptyPrize);
      setNotice('奖品已创建');
    });
  };

  const savePrize = async (prize: Prize) => {
    if (csrfToken === undefined) return;
    await runSave(`prize-${prize.id}`, async () => {
      const saved = await updatePrize(
        prize.id,
        {
          name: prize.name,
          description: prize.description,
          claimInstructions: prize.claimInstructions,
          gradeIds: prize.gradeIds,
        },
        csrfToken,
      );
      changePrize(saved.id, saved);
      setNotice('奖品已保存');
    });
  };

  const togglePrizeStatus = async (prize: Prize) => {
    if (csrfToken === undefined) return;
    await runSave(`status-${prize.id}`, async () => {
      const saved = await setPrizeEnabled(
        prize.id,
        prize.status === 'DISABLED',
        csrfToken,
      );
      changePrize(saved.id, saved);
      setNotice(saved.status === 'ACTIVE' ? '奖品已启用' : '奖品已停用');
    });
  };

  const saveCurrentPrize = async (grade: Grade) => {
    if (csrfToken === undefined || grade.currentPrizeId === null) return;
    await runSave(`current-${grade.id}`, async () => {
      const saved = await setGradeCurrentPrize(
        grade.id,
        grade.currentPrizeId ?? '',
        csrfToken,
      );
      setGrades((current) =>
        current?.map((candidate) =>
          candidate.id === saved.id ? saved : candidate,
        ),
      );
      setNotice('当前奖品已保存');
    });
  };

  if (grades === undefined || prizes === undefined) {
    return (
      <main className="dashboard-shell" aria-busy={error === undefined}>
        {error === undefined ? (
          <p className="loading-state">正在加载奖品与年级配置…</p>
        ) : (
          <section className="status-card" role="alert">
            <h1>奖品管理暂不可用</h1>
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
          <strong>奖品管理</strong>
        </div>
        <Link className="text-button" href="/dashboard">
          返回总览
        </Link>
      </header>
      <main className="dashboard-content catalog-content">
        <div className="page-heading">
          <p className="eyebrow">线下实物奖励</p>
          <h1>奖品与年级配置</h1>
          <p className="muted">
            只维护纯文字奖品信息，领取和交付全部在线下完成。
          </p>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="success-notice" role="status">
            {notice}
          </p>
        ) : null}

        <section
          className="catalog-section"
          aria-labelledby="current-prizes-title"
        >
          <h2 id="current-prizes-title">年级当前奖品</h2>
          <div className="catalog-list">
            {grades.map((grade) => {
              const eligible = prizes.filter(
                (prize) =>
                  prize.status === 'ACTIVE' &&
                  prize.gradeIds.includes(grade.id),
              );
              return (
                <div className="current-prize-row" key={grade.id}>
                  <label>
                    {grade.name}当前奖品
                    <select
                      value={grade.currentPrizeId ?? ''}
                      onChange={(event) =>
                        setGrades((current) =>
                          current?.map((candidate) =>
                            candidate.id === grade.id
                              ? {
                                  ...candidate,
                                  currentPrizeId: event.target.value || null,
                                }
                              : candidate,
                          ),
                        )
                      }
                    >
                      <option value="">尚未设置</option>
                      {eligible.map((prize) => (
                        <option key={prize.id} value={prize.id}>
                          {prize.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary-button compact-button"
                    type="button"
                    disabled={
                      grade.currentPrizeId === null ||
                      savingKey === `current-${grade.id}`
                    }
                    onClick={() => void saveCurrentPrize(grade)}
                  >
                    保存当前奖品
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="catalog-section" aria-labelledby="prizes-title">
          <h2 id="prizes-title">奖品</h2>
          <div className="catalog-create-card prize-editor">
            <label>
              奖品名称
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <label>
              奖品说明
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </label>
            <label>
              线下领取说明
              <textarea
                value={draft.claimInstructions}
                onChange={(event) =>
                  setDraft({ ...draft, claimInstructions: event.target.value })
                }
              />
            </label>
            <div className="checkbox-grid">
              {grades.map((grade) => (
                <label key={grade.id}>
                  <input
                    type="checkbox"
                    checked={draft.gradeIds.includes(grade.id)}
                    onChange={() => toggleDraftGrade(grade.id)}
                  />
                  适用{grade.name}
                </label>
              ))}
            </div>
            <button
              className="primary-button compact-button"
              type="button"
              disabled={
                savingKey === 'new' ||
                !draft.name.trim() ||
                !draft.description.trim() ||
                !draft.claimInstructions.trim() ||
                draft.gradeIds.length === 0
              }
              onClick={() => void addPrize()}
            >
              创建奖品
            </button>
          </div>

          {prizes.length === 0 ? (
            <p className="empty-state">暂未创建奖品。</p>
          ) : null}
          <div className="catalog-list">
            {prizes.map((prize) => (
              <fieldset
                className="catalog-row prize-row"
                key={prize.id}
                aria-label={prize.name}
              >
                <legend>{prize.name}</legend>
                <label>
                  奖品名称
                  <input
                    value={prize.name}
                    onChange={(event) =>
                      changePrize(prize.id, { name: event.target.value })
                    }
                  />
                </label>
                <label>
                  奖品说明
                  <textarea
                    value={prize.description}
                    onChange={(event) =>
                      changePrize(prize.id, { description: event.target.value })
                    }
                  />
                </label>
                <label>
                  线下领取说明
                  <textarea
                    value={prize.claimInstructions}
                    onChange={(event) =>
                      changePrize(prize.id, {
                        claimInstructions: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="checkbox-grid">
                  {grades.map((grade) => (
                    <label key={grade.id}>
                      <input
                        type="checkbox"
                        checked={prize.gradeIds.includes(grade.id)}
                        onChange={() => togglePrizeGrade(prize, grade.id)}
                      />
                      {grade.name}
                    </label>
                  ))}
                </div>
                <div className="prize-actions">
                  <button
                    className="primary-button compact-button"
                    type="button"
                    disabled={
                      savingKey === `prize-${prize.id}` ||
                      prize.gradeIds.length === 0
                    }
                    onClick={() => void savePrize(prize)}
                  >
                    保存奖品
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    disabled={savingKey === `status-${prize.id}`}
                    onClick={() => void togglePrizeStatus(prize)}
                  >
                    {prize.status === 'ACTIVE' ? '停用奖品' : '启用奖品'}
                  </button>
                  <span className="status-pill">
                    {prize.status === 'ACTIVE' ? '已启用' : '已停用'}
                  </span>
                </div>
              </fieldset>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
