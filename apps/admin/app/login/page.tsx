import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            ∑
          </div>
          <div>
            <strong>数学小达人</strong>
            <span>管理控制台</span>
          </div>
        </div>
        <h1 id="login-title">欢迎回来</h1>
        <p className="muted">
          使用系统管理员账号登录，继续维护数学题与奖励配置。
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
