import { useEffect, useState } from "react";
import api from "../api/http";

const initialStats = {
  assignedRides: 0,
  activeRides: 0,
  completedRides: 0,
  openRides: 0,
  earnedAmount: 0
};

function DriverPanel(props) {
  const auth = props.auth;
  const liveDrivers = props.liveDrivers || [];
  const defaultName = auth && auth.user ? auth.user.name : "";
  const realtimeUrl = import.meta.env.VITE_REALTIME_URL || "http://localhost:8080";

  const [profile, setProfile] = useState({
    name: defaultName,
    phone: "",
    vehicleType: "bike",
    vehicleNumber: ""
  });
  const [locationForm, setLocationForm] = useState({
    lat: "28.6139",
    lng: "77.2090"
  });
  const [driver, setDriver] = useState(null);
  const [assignedRides, setAssignedRides] = useState([]);
  const [openRides, setOpenRides] = useState([]);
  const [stats, setStats] = useState(initialStats);
  const [isSimulatorOn, setIsSimulatorOn] = useState(false);
  const [message, setMessage] = useState("");

  function isValidNumber(value) {
    if (value === "") {
      return false;
    }

    return !Number.isNaN(Number(value));
  }

  function toRad(value) {
    return (value * Math.PI) / 180;
  }

  function getDistanceKm(lat1, lng1, lat2, lng2) {
    const earthRadius = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
  }

  function getNextLocation(lat, lng, targetLat, targetLng) {
    const stepRatio = 0.3;

    return {
      lat: lat + (targetLat - lat) * stepRatio,
      lng: lng + (targetLng - lng) * stepRatio
    };
  }

  function formatLocationValue(value) {
    return Number(value).toFixed(4);
  }

  function formatTime(value) {
    if (!value) {
      return "";
    }

    return new Date(value).toLocaleString();
  }

  function getRideTimeText(ride) {
    const parts = [];

    if (ride.acceptedAt) {
      parts.push(`Accepted: ${formatTime(ride.acceptedAt)}`);
    }

    if (ride.startedAt) {
      parts.push(`Started: ${formatTime(ride.startedAt)}`);
    }

    if (ride.completedAt) {
      parts.push(`Completed: ${formatTime(ride.completedAt)}`);
    }

    if (ride.cancelledAt) {
      parts.push(`Cancelled: ${formatTime(ride.cancelledAt)}`);
    }

    return parts.join(" | ");
  }

  function getTrackingTarget(ride) {
    if (!ride) {
      return null;
    }

    if (ride.status === "driver_assigned") {
      return {
        label: "pickup",
        lat: ride.pickupLat,
        lng: ride.pickupLng
      };
    }

    if (ride.status === "in_progress") {
      return {
        label: "drop",
        lat: ride.dropLat,
        lng: ride.dropLng
      };
    }

    return null;
  }

  function handleProfile(e) {
    const name = e.target.name;
    const value = e.target.value;

    setProfile({
      ...profile,
      [name]: value
    });
  }

  function handleLocation(e) {
    const name = e.target.name;
    const value = e.target.value;

    setLocationForm({
      ...locationForm,
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

  async function loadAssignedRides() {
    if (!auth || !auth.token) {
      return;
    }

    if (!auth.user || auth.user.role !== "driver") {
      return;
    }

    try {
      const response = await api.get("/rides/driver");

      if (response.data && response.data.rides) {
        setAssignedRides(response.data.rides);
      } else {
        setAssignedRides([]);
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        setAssignedRides([]);
        return;
      }

      setMessage("Could not load assigned rides");
    }
  }

  async function loadOpenRides() {
    if (!auth || !auth.token) {
      return;
    }

    if (!auth.user || auth.user.role !== "driver") {
      return;
    }

    try {
      const response = await api.get("/rides/open");

      if (response.data && response.data.rides) {
        setOpenRides(response.data.rides);
      } else {
        setOpenRides([]);
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        setOpenRides([]);
        return;
      }

      setMessage("Could not load open rides");
    }
  }

  async function loadStats() {
    if (!auth || !auth.token) {
      return;
    }

    if (!auth.user || auth.user.role !== "driver") {
      return;
    }

    try {
      const response = await api.get("/rides/stats/driver");

      if (response.data && response.data.stats) {
        setStats(response.data.stats);
      } else {
        setStats(initialStats);
      }
    } catch {
      setMessage("Could not load driver stats");
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
      loadAssignedRides();
      loadOpenRides();
      loadStats();
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
        setIsSimulatorOn(false);
        await clearLocation(response.data.driver);
        setMessage("Driver is offline");
      }
    } catch {
      setMessage("Status update failed");
    }
  }

  async function clearLocation(savedDriver) {
    const driverId = savedDriver && (savedDriver._id || savedDriver.id);

    if (!driverId) {
      return;
    }

    try {
      await fetch(`${realtimeUrl}/drivers/${driverId}`, {
        method: "DELETE"
      });
    } catch {
      return;
    }
  }

  async function pushLocation(lat, lng, successMessage) {
    if (!driver) {
      return false;
    }

    try {
      const response = await fetch(`${realtimeUrl}/drivers/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          driverId: driver._id || driver.id,
          name: driver.name,
          vehicleType: driver.vehicleType,
          lat: Number(lat),
          lng: Number(lng)
        })
      });

      if (!response.ok) {
        setMessage("Location update failed");
        return false;
      }

      setLocationForm({
        lat: formatLocationValue(lat),
        lng: formatLocationValue(lng)
      });

      if (successMessage) {
        setMessage(successMessage);
      }

      return true;
    } catch {
      setMessage("Location update failed");
      return false;
    }
  }

  async function shareLocation() {
    if (!driver) {
      setMessage("Onboard driver first");
      return;
    }

    if (!driver.isOnline) {
      setMessage("Go online first");
      return;
    }

    if (!isValidNumber(locationForm.lat) || !isValidNumber(locationForm.lng)) {
      setMessage("Enter valid driver location");
      return;
    }

    await pushLocation(Number(locationForm.lat), Number(locationForm.lng), "Location shared");
  }

  async function updateRideStatus(rideId, status) {
    try {
      const response = await api.patch(`/rides/${rideId}/status`, {
        status: status
      });
      const updatedRide = response.data.ride;

      setAssignedRides(function(prevRides) {
        return prevRides.map(function(item) {
          const currentId = item._id || item.id;

          if (currentId === rideId) {
            return updatedRide;
          }

          return item;
        });
      });
      loadStats();

      if (status === "in_progress") {
        setMessage("Ride started");
      } else {
        setIsSimulatorOn(false);
        setMessage("Ride completed");
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Ride update failed");
      }
    }
  }

  async function claimRide(rideId) {
    try {
      const response = await api.patch(`/rides/${rideId}/claim`);
      const claimedRide = response.data.ride;

      setAssignedRides(function(prevRides) {
        return [claimedRide, ...prevRides];
      });
      setOpenRides(function(prevRides) {
        return prevRides.filter(function(item) {
          const currentId = item._id || item.id;
          return currentId !== rideId;
        });
      });
      loadStats();
      setMessage("Ride accepted");
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Ride accept failed");
      }
    }
  }

  useEffect(() => {
    const timer = setTimeout(function() {
      loadDriver();
      loadAssignedRides();
      loadOpenRides();
      loadStats();
    }, 0);

    return function() {
      clearTimeout(timer);
    };
  }, [auth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!auth || !auth.token) {
      return;
    }

    if (!auth.user || auth.user.role !== "driver") {
      return;
    }

    const timer = setInterval(function() {
      loadAssignedRides();
      loadOpenRides();
      loadStats();
    }, 5000);

    return function() {
      clearInterval(timer);
    };
  }, [auth]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRide = assignedRides.find(function(ride) {
    return ride.status === "driver_assigned" || ride.status === "in_progress";
  });

  const driverId = driver ? driver._id || driver.id : "";
  let currentLiveDriver = null;

  if (driverId) {
    currentLiveDriver = liveDrivers.find(function(item) {
      return item.driverId === driverId;
    });
  }

  const trackingTarget = getTrackingTarget(activeRide);
  let remainingDistanceKm = null;

  if (
    trackingTarget &&
    currentLiveDriver &&
    isValidNumber(currentLiveDriver.lat) &&
    isValidNumber(currentLiveDriver.lng)
  ) {
    remainingDistanceKm = getDistanceKm(
      Number(currentLiveDriver.lat),
      Number(currentLiveDriver.lng),
      Number(trackingTarget.lat),
      Number(trackingTarget.lng)
    );
  } else if (
    trackingTarget &&
    isValidNumber(locationForm.lat) &&
    isValidNumber(locationForm.lng)
  ) {
    remainingDistanceKm = getDistanceKm(
      Number(locationForm.lat),
      Number(locationForm.lng),
      Number(trackingTarget.lat),
      Number(trackingTarget.lng)
    );
  }

  useEffect(() => {
    if (!activeRide) {
      const timer = setTimeout(function() {
        setIsSimulatorOn(false);
      }, 0);

      return function() {
        clearTimeout(timer);
      };
    }
  }, [activeRide]);

  useEffect(() => {
    if (!isSimulatorOn) {
      return;
    }

    if (!driver || !driver.isOnline) {
      return;
    }

    if (!activeRide) {
      return;
    }

    const target = getTrackingTarget(activeRide);

    if (!target) {
      return;
    }

    if (!isValidNumber(locationForm.lat) || !isValidNumber(locationForm.lng)) {
      const stopTimer = setTimeout(function() {
        setIsSimulatorOn(false);
        setMessage("Enter valid driver location");
      }, 0);

      return function() {
        clearTimeout(stopTimer);
      };
    }

    const timer = setInterval(async function() {
      const currentLat = Number(locationForm.lat);
      const currentLng = Number(locationForm.lng);
      const distanceKm = getDistanceKm(
        currentLat,
        currentLng,
        Number(target.lat),
        Number(target.lng)
      );

      if (distanceKm < 0.05) {
        setIsSimulatorOn(false);

        if (target.label === "pickup") {
          setMessage("Reached pickup area");
        } else {
          setMessage("Reached drop area");
        }

        return;
      }

      const nextLocation = getNextLocation(
        currentLat,
        currentLng,
        Number(target.lat),
        Number(target.lng)
      );

      const saved = await pushLocation(nextLocation.lat, nextLocation.lng, "");

      if (!saved) {
        setIsSimulatorOn(false);
      }
    }, 2500);

    return function() {
      clearInterval(timer);
    };
  }, [isSimulatorOn, driver, activeRide, locationForm]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTripSimulation() {
    if (!activeRide) {
      setMessage("No active ride to simulate");
      return;
    }

    if (!driver || !driver.isOnline) {
      setMessage("Go online first");
      return;
    }

    if (!isValidNumber(locationForm.lat) || !isValidNumber(locationForm.lng)) {
      setMessage("Enter valid driver location");
      return;
    }

    if (isSimulatorOn) {
      setIsSimulatorOn(false);
      setMessage("Trip simulation stopped");
    } else {
      setIsSimulatorOn(true);
      setMessage("Trip simulation started");
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

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-number">{stats.assignedRides}</div>
          <div className="muted">Assigned rides</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{stats.activeRides}</div>
          <div className="muted">Active rides</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{stats.openRides}</div>
          <div className="muted">Open rides</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">Rs {stats.earnedAmount}</div>
          <div className="muted">Completed earnings</div>
        </div>
      </div>

      <div className="list-box">
        <h3>Driver Profile</h3>
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
      </div>

      <div className="list-box">
        <h3>Driver Location</h3>
        <div className="form-grid">
          <input
            name="lat"
            value={locationForm.lat}
            onChange={handleLocation}
            placeholder="lat"
          />
          <input
            name="lng"
            value={locationForm.lng}
            onChange={handleLocation}
            placeholder="lng"
          />
        </div>
        {currentLiveDriver ? (
          <div className="mini-box compact-box">
            <p className="muted">
              Live shared: {currentLiveDriver.lat?.toFixed?.(4)}, {currentLiveDriver.lng?.toFixed?.(4)}
            </p>
            {currentLiveDriver.updatedAt ? (
              <p className="muted">Updated: {formatTime(currentLiveDriver.updatedAt)}</p>
            ) : null}
          </div>
        ) : null}
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
        <button className="ghost-btn" onClick={shareLocation}>
          Share Location
        </button>
        {activeRide ? (
          <button className="ghost-btn" onClick={toggleTripSimulation}>
            {isSimulatorOn
              ? "Stop Simulation"
              : activeRide.status === "driver_assigned"
                ? "Simulate Pickup"
                : "Simulate Trip"}
          </button>
        ) : null}
      </div>

      {driver ? (
        <div className="mini-box">
          <p>
            <strong>{driver.name}</strong> | {driver.vehicleType} |{" "}
            {driver.isOnline ? "online" : "offline"}
          </p>
          <p className="muted">Vehicle number: {driver.vehicleNumber || "not saved"}</p>
        </div>
      ) : null}

      {message ? <p className="message">{message}</p> : null}

      {activeRide ? (
        <div className="list-box">
          <h3>Current Trip</h3>
          <div className="mini-box">
            <p>
              <strong>{activeRide.pickupText}</strong> to <strong>{activeRide.dropText}</strong>
            </p>
            <p className="muted">
              {activeRide.status} | Rs {activeRide.fare} | {activeRide.distanceKm} km
            </p>
            <p className="muted">Rider: {activeRide.riderName || "Unknown rider"}</p>
            {trackingTarget ? (
              <p className="muted">
                Heading to {trackingTarget.label}
                {remainingDistanceKm !== null ? ` | ${remainingDistanceKm.toFixed(2)} km left` : ""}
              </p>
            ) : null}
            {getRideTimeText(activeRide) ? (
              <p className="time-text">{getRideTimeText(activeRide)}</p>
            ) : null}

            <div className="inline-actions trip-actions">
              {activeRide.status === "driver_assigned" ? (
                <button
                  className="primary-btn"
                  onClick={function() {
                    updateRideStatus(activeRide._id || activeRide.id, "in_progress");
                  }}
                >
                  Start Ride
                </button>
              ) : null}

              {activeRide.status === "in_progress" ? (
                <button
                  className="ghost-btn"
                  onClick={function() {
                    updateRideStatus(activeRide._id || activeRide.id, "completed");
                  }}
                >
                  Complete Ride
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="list-box">
        <div className="card-head">
          <h3>Assigned Rides</h3>
          <button className="ghost-btn" onClick={loadAssignedRides}>
            Refresh Rides
          </button>
        </div>

        {assignedRides.length === 0 ? (
          <p className="muted">No assigned rides yet</p>
        ) : null}

        {assignedRides.map(function(ride) {
          const rideId = ride._id || ride.id;

          return (
            <div className="list-item" key={rideId}>
              <div>
                <strong>{ride.pickupText}</strong> to <strong>{ride.dropText}</strong>
                <div className="muted">
                  {ride.status} | Rs {ride.fare} | {ride.distanceKm} km
                </div>
                <div className="muted">Rider: {ride.riderName || "Unknown rider"}</div>
                {getRideTimeText(ride) ? (
                  <div className="time-text">{getRideTimeText(ride)}</div>
                ) : null}
              </div>

              <div className="inline-actions">
                {ride.status === "driver_assigned" ? (
                  <button
                    className="primary-btn"
                    onClick={function() {
                      updateRideStatus(rideId, "in_progress");
                    }}
                  >
                    Start Ride
                  </button>
                ) : null}

                {ride.status === "in_progress" ? (
                  <button
                    className="ghost-btn"
                    onClick={function() {
                      updateRideStatus(rideId, "completed");
                    }}
                  >
                    Complete Ride
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="list-box">
        <div className="card-head">
          <h3>Available Rides</h3>
          <button className="ghost-btn" onClick={loadOpenRides}>
            Refresh Open
          </button>
        </div>

        {openRides.length === 0 ? <p className="muted">No open rides right now</p> : null}

        {openRides.map(function(ride) {
          const rideId = ride._id || ride.id;

          return (
            <div className="list-item" key={rideId}>
              <div>
                <strong>{ride.pickupText}</strong> to <strong>{ride.dropText}</strong>
                <div className="muted">
                  {ride.status} | Rs {ride.fare} | {ride.distanceKm} km
                </div>
                <div className="muted">Rider: {ride.riderName || "Unknown rider"}</div>
              </div>

              <div className="inline-actions">
                <button
                  className="primary-btn"
                  onClick={function() {
                    claimRide(rideId);
                  }}
                >
                  Accept Ride
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DriverPanel;
