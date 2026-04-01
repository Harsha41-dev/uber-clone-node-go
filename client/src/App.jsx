import { useEffect, useState } from "react";
import AuthCard from "./components/AuthCard";
import DriverPanel from "./components/DriverPanel";
import LiveDrivers from "./components/LiveDrivers";
import RiderPanel from "./components/RiderPanel";
import { setToken } from "./api/http";

function App() {
  const [authData, setAuthData] = useState(null);
  const [liveDrivers, setLiveDrivers] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("uber_auth");

    if (!saved) {
      return;
    }

    const parsedData = JSON.parse(saved);
    setAuthData(parsedData);
    setToken(parsedData.token);
  }, []);

  useEffect(() => {
    const realtimeUrl = import.meta.env.VITE_REALTIME_URL || "http://localhost:8080";
    const wsUrl = realtimeUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://") + "/ws";
    const socket = new WebSocket(wsUrl);

    socket.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "drivers:update") {
          setLiveDrivers(data.drivers || []);
        }
      } catch (error) {
        return;
      }
    };

    socket.onclose = function() {
      setLiveDrivers([]);
    };

    return function() {
      socket.close();
    };
  }, []);

  return (
    <div className="page-shell">
      <div className="hero">
        <p className="eyebrow">Uber Clone | MERN + Go</p>
        <h1>Auth, ride lifecycle and live driver tracking are ready</h1>
        <p className="hero-copy">
          Users can register as rider or driver. Riders can get fare estimates
          and book rides. Drivers can save onboarding details, move online or
          offline, share location to the live driver list, accept open rides,
          and move trips forward from assigned to completed.
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

      {authData && authData.user && authData.user.role === "driver" ? (
        <div className="section-gap">
          <DriverPanel auth={authData} />
        </div>
      ) : null}

      {authData && authData.user && authData.user.role === "rider" ? (
        <div className="section-gap">
          <RiderPanel auth={authData} liveDrivers={liveDrivers} />
        </div>
      ) : null}

      <div className="section-gap">
        <LiveDrivers drivers={liveDrivers} />
      </div>
    </div>
  );
}

export default App;
