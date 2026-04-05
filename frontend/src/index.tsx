/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import App from "./App";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import TripView from "./pages/TripView";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

render(
  () => (
    <AuthProvider>
      <Router>
        <Route path="/" component={App} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/trips/:tripId" component={TripView} />
      </Router>
    </AuthProvider>
  ),
  document.getElementById("root")!
);
