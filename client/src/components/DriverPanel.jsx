import { useEffect, useState } from "react";
import api from "../api/http";

function DriverPanel(props) {
  const auth = props.auth;
  const defaultName = auth && auth.user ? auth.user.name : "";

  const [profile, setProfile] = useState({
    name: defaultName,
    phone: "",
    vehicleType: "bike",
    vehicleNumber: ""
  });
  const [driver, setDriver] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDriver();
  }, [auth]);

  function handleProfile(e) {
    const name = e.target.name;
    const value = e.target.value;

    setProfile({
      ...profile,
      [name]: value
    });
  }

  async function loadDriver() {
    if (!auth || !auth.token) {
      return;
    }

    if (!auth.user || auth.user.role !== "driver") {
      return;
    }

    try {
      const response = await api.get("/drivers/me");
      const savedDriver = response.data.driver;

      setDriver(savedDriver);
      setProfile({
        name: savedDriver.name || defaultName,
        phone: savedDriver.phone || "",
        vehicleType: savedDriver.vehicleType || "bike",
        vehicleNumber: savedDriver.vehicleNumber || ""
      });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return;
      }
    }
  }

  async function onboardDriver() {
    if (!auth || !auth.token) {
      setMessage("Login first");
      return;
    }

    try {
      const response = await api.post("/drivers/onboard", profile);

      setDriver(response.data.driver);
      setMessage("Driver onboarded");
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Onboarding failed");
      }
    }
  }

  async function updateStatus(isOnline) {
    if (!driver) {
      setMessage("Onboard driver first");
      return;
    }

    try {
      const response = await api.patch("/drivers/me/status", {
        isOnline: isOnline
      });

      setDriver(response.data.driver);

      if (isOnline) {
        setMessage("Driver is online");
      } else {
        setMessage("Driver is offline");
      }
    } catch (error) {
      setMessage("Status update failed");
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Driver Panel</h2>
        <button className="ghost-btn" onClick={onboardDriver}>
          Save Driver
        </button>
      </div>

      <div className="form-grid">
        <input
          name="name"
          value={profile.name}
          onChange={handleProfile}
          placeholder="driver name"
        />
        <input
          name="phone"
          value={profile.phone}
          onChange={handleProfile}
          placeholder="phone"
        />
        <input
          name="vehicleType"
          value={profile.vehicleType}
          onChange={handleProfile}
          placeholder="vehicle type"
        />
        <input
          name="vehicleNumber"
          value={profile.vehicleNumber}
          onChange={handleProfile}
          placeholder="vehicle number"
        />
      </div>

      <div className="row-actions">
        <button
          className="primary-btn"
          onClick={function() {
            updateStatus(true);
          }}
        >
          Go Online
        </button>
        <button
          className="ghost-btn"
          onClick={function() {
            updateStatus(false);
          }}
        >
          Go Offline
        </button>
      </div>

      {driver ? (
        <div className="mini-box">
          <strong>{driver.name}</strong> | {driver.vehicleType} |{" "}
          {driver.isOnline ? "online" : "offline"}
        </div>
      ) : null}

      {message ? <p className="message">{message}</p> : null}
    </div>
  );
}

export default DriverPanel;
