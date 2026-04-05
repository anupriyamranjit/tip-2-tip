import { createSignal } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";

export default function Signup() {
  const [email, setEmail] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const auth = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (password() !== confirmPassword()) {
      setError("Passwords do not match");
      return;
    }

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
        <div class="auth-brand">
          <h1>Editorial Wanderlust</h1>
          <span class="tagline">Your Journey, Curated.</span>
        </div>

        {error() && <div class="error-message">{error()}</div>}

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="username">Full Name</label>
            <input
              id="username"
              type="text"
              placeholder="Julianne Moore"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              required
              minLength={3}
            />
          </div>

          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="hello@wanderlust.com"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              required
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                minLength={8}
              />
            </div>
            <div class="form-group">
              <label for="confirm">Confirm</label>
              <input
                id="confirm"
                type="password"
                placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                required
                minLength={8}
              />
            </div>
          </div>

          <button type="submit" class="btn-primary" disabled={loading()}>
            {loading() ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div class="auth-divider">
          <span>Or join with</span>
        </div>

        <div class="social-buttons">
          <button class="social-btn" type="button" aria-label="Sign up with Google">G</button>
          <button class="social-btn" type="button" aria-label="Sign up with Apple">&#xF8FF;</button>
        </div>

        <div class="auth-footer">
          Already have an account? <A href="/login">Sign In</A>
        </div>
      </div>

      <span class="location-tag">Uncharted Territories</span>
      <span class="copyright">&copy; 2024 Editorial Wanderlust. All Rights Reserved.</span>
    </div>
  );
}
