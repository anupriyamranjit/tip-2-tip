import { createSignal } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

export default function Login() {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const auth = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.login({ email: email(), password: password() });
      auth.login(res.token, res.user);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="auth-layout">
      <div class="auth-card">
        <h1>Welcome back</h1>
        <p class="subtitle">Sign in to your Tip2Tip account</p>

        {error() && <div class="error-message">{error()}</div>}

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              required
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Your password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              required
            />
          </div>

          <button type="submit" class="btn-primary" disabled={loading()}>
            {loading() ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div class="auth-footer">
          Don't have an account? <A href="/signup">Sign up</A>
        </div>
      </div>
    </div>
  );
}
