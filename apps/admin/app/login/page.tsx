import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          ∑
        </div>
        <p className="eyebrow">数学小达人</p>
        <h1 id="login-title">管理后台登录</h1>
        <p className="muted">仅限系统管理员使用</p>
        <LoginForm />
      </section>
    </main>
  );
}
