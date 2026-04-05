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
        <div class="auth-brand">
          <h1>Editorial Wanderlust</h1>
          <span class="tagline">Digital Concierge</span>
        </div>

        {error() && <div class="error-message">{error()}</div>}

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="julian.traverse@explorer.com"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              required
            />
          </div>

          <div class="form-group">
            <div class="label-row">
              <label for="password">Password</label>
              <a href="#" class="forgot-link">Forgot Password?</a>
            </div>
            <input
              id="password"
              type="password"
              placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              required
            />
          </div>

          <button type="submit" class="btn-primary" disabled={loading()}>
            {loading() ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div class="auth-divider">
          <span>Continue with</span>
        </div>

        <div class="social-buttons">
          <button class="social-btn" type="button" aria-label="Sign in with Google">G</button>
          <button class="social-btn" type="button" aria-label="Sign in with Apple">&#xF8FF;</button>
        </div>

        <div class="auth-footer">
          Don't have an account? <A href="/signup">Start your journey</A>
        </div>
      </div>

      <span class="location-tag">Mt. Fitz Roy, Patagonia</span>
      <span class="copyright">&copy; 2024 Editorial Wanderlust. All Rights Reserved.</span>
    </div>
  );
}
