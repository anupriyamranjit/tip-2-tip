import { createContext, useContext, createSignal, ParentComponent } from "solid-js";

interface User {
  id: string;
  email: string;
  username: string;
}

interface AuthContextValue {
  token: () => string | null;
  user: () => User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>();

export const AuthProvider: ParentComponent = (props) => {
  const [token, setToken] = createSignal<string | null>(
    sessionStorage.getItem("token")
  );
  const [user, setUser] = createSignal<User | null>(
    (() => {
      const stored = sessionStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    })()
  );

  const login = (newToken: string, newUser: User) => {
    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {props.children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
