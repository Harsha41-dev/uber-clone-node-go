import { useEffect, useState } from "react";
import AuthCard from "./components/AuthCard";
import { setToken } from "./api/http";

function App() {
  const [authData, setAuthData] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("uber_auth");

    if (!saved) {
      return;
    }

    const parsedData = JSON.parse(saved);
    setAuthData(parsedData);
    setToken(parsedData.token);
  }, []);

  return (
    <div className="page-shell">
      <div className="hero">
        <p className="eyebrow">Uber Clone | MERN + Go</p>
        <h1>Basic auth flow is ready</h1>
        <p className="hero-copy">
          Today is focused on simple login and register flow. Rider flow, driver
          flow and realtime tracking will come step by step.
        </p>
      </div>

      <div className="auth-layout">
        <AuthCard onAuth={setAuthData} />

        <div className="card">
          <h2>Auth status</h2>
          {authData ? (
            <div className="mini-box">
              <p>
                Logged in as <strong>{authData.user.name}</strong>
              </p>
              <p className="muted">{authData.user.email}</p>
              <p className="muted">Role: {authData.user.role}</p>
            </div>
          ) : (
            <p className="muted">No user logged in yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
