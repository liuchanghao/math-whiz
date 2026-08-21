import { createSuccess } from '@math-whiz/contracts';

export default function HomePage() {
  const baseline = createSuccess('工程基线可用', {
    application: 'admin',
  });

  return (
    <main>
      <section className="card">
        <p className="eyebrow">状态 {baseline.status}</p>
        <h1>数学小达人管理后台</h1>
        <p>{baseline.message}</p>
      </section>
    </main>
  );
}
