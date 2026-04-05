import { createSignal } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

export default function Signup() {
  const [email, setEmail] = createSignal("");
  const [username, setUsername] = createSignal("");
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
      const res = await api.signup({
        email: email(),
        username: username(),
        password: password(),
      });
      auth.login(res.token, res.user);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="auth-layout">
      <div class="auth-card">
        <h1>Create account</h1>
        <p class="subtitle">Start planning your trips with Tip2Tip</p>

        {error() && <div class="error-message">{error()}</div>}

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Choose a username"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              required
              minLength={3}
            />
          </div>

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
              placeholder="At least 8 characters"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              required
              minLength={8}
            />
          </div>

          <button type="submit" class="btn-primary" disabled={loading()}>
            {loading() ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div class="auth-footer">
          Already have an account? <A href="/login">Sign in</A>
        </div>
      </div>
    </div>
  );
}
