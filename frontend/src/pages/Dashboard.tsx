import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { useAuth } from "../lib/auth";

export default function Dashboard() {
  const auth = useAuth();
  const navigate = useNavigate();

  onMount(() => {
    if (!auth.token()) {
      navigate("/login", { replace: true });
    }
  });

  const handleLogout = () => {
    auth.logout();
    navigate("/login", { replace: true });
  };

  return (
    <div class="dashboard-layout">
      <h1>Welcome, {auth.user()?.username ?? "traveler"}!</h1>
      <p>You're signed in as {auth.user()?.email}. Trip planning features coming soon.</p>
      <button class="btn-logout" onClick={handleLogout}>
        Sign Out
      </button>
    </div>
  );
}
