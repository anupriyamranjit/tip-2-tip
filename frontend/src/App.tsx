import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { useAuth } from "./lib/auth";

export default function App() {
  const navigate = useNavigate();
  const auth = useAuth();

  onMount(() => {
    if (auth.token()) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  });

  return null;
}
