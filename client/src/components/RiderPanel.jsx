import { useEffect, useState } from "react";
import api from "../api/http";

const initialRide = {
  pickupText: "Sector 62, Noida",
  pickupLat: "28.6285",
  pickupLng: "77.3649",
  dropText: "Connaught Place, Delhi",
  dropLat: "28.6315",
  dropLng: "77.2167"
};

const initialStats = {
  totalRides: 0,
  activeRides: 0,
  completedRides: 0,
  cancelledRides: 0,
  spentAmount: 0
};

function RiderPanel(props) {
  const auth = props.auth;
  const liveDrivers = props.liveDrivers || [];

  const [form, setForm] = useState(initialRide);
  const [estimate, setEstimate] = useState(null);
  const [rides, setRides] = useState([]);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [stats, setStats] = useState(initialStats);
  const [message, setMessage] = useState("");

  function isValidNumber(value) {
    if (value === "") {
      return false;
    }

    return !Number.isNaN(Number(value));
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

  function handleChange(e) {
    const name = e.target.name;
    const value = e.target.value;

    setForm({
      ...form,
      [name]: value
    });
  }

  async function loadRides() {
    if (!auth || !auth.token) {
      return;
    }

    try {
      const response = await api.get("/rides");

      if (response.data && response.data.rides) {
        setRides(response.data.rides);
      } else {
        setRides([]);
      }
    } catch (error) {
      setMessage("Could not load rides");
    }
  }

  async function loadStats() {
    if (!auth || !auth.token) {
      return;
    }

    try {
      const response = await api.get("/rides/stats/rider");

      if (response.data && response.data.stats) {
        setStats(response.data.stats);
      } else {
        setStats(initialStats);
      }
    } catch (error) {
      setMessage("Could not load rider stats");
    }
  }

  async function getEstimate() {
    if (
      !isValidNumber(form.pickupLat) ||
      !isValidNumber(form.pickupLng) ||
      !isValidNumber(form.dropLat) ||
      !isValidNumber(form.dropLng)
    ) {
      setMessage("Enter valid pickup and drop coordinates");
      return;
    }

    try {
      const response = await api.post("/rides/estimate", form);

      setEstimate(response.data);
      setMessage("Estimate updated");
    } catch (error) {
      setMessage("Estimate failed");
    }
  }

  async function bookRide() {
    if (!auth || !auth.token) {
      setMessage("Login first to book ride");
      return;
    }

    if (!form.pickupText || !form.dropText) {
      setMessage("Enter pickup and drop text");
      return;
    }

    if (
      !isValidNumber(form.pickupLat) ||
      !isValidNumber(form.pickupLng) ||
      !isValidNumber(form.dropLat) ||
      !isValidNumber(form.dropLng)
    ) {
      setMessage("Enter valid pickup and drop coordinates");
      return;
    }

    try {
      const response = await api.post("/rides", form);
      const newRide = response.data.ride;
      const drivers = response.data.nearbyDrivers || [];

      setNearbyDrivers(drivers);
      setEstimate({
        fare: newRide.fare,
        distanceKm: newRide.distanceKm
      });
      setRides(function(prevRides) {
        return [newRide, ...prevRides];
      });
      loadStats();

      if (newRide.driverId) {
        setMessage("Driver assigned");
      } else {
        setMessage("Ride created, waiting for driver");
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Ride booking failed");
      }
    }
  }

  async function cancelRide(rideId) {
    try {
      const response = await api.patch(`/rides/${rideId}/cancel`);
      const updatedRide = response.data.ride;

      setRides(function(prevRides) {
        return prevRides.map(function(item) {
          const currentId = item._id || item.id;

          if (currentId === rideId) {
            return updatedRide;
          }

          return item;
        });
      });
      loadStats();
      setMessage("Ride cancelled");
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Ride cancel failed");
      }
    }
  }

  async function retryDriverSearch(rideId) {
    try {
      const response = await api.patch(`/rides/${rideId}/retry`);
      const updatedRide = response.data.ride;
      const drivers = response.data.nearbyDrivers || [];

      setNearbyDrivers(drivers);
      setRides(function(prevRides) {
        return prevRides.map(function(item) {
          const currentId = item._id || item.id;

          if (currentId === rideId) {
            return updatedRide;
          }

          return item;
        });
      });
      loadStats();

      if (updatedRide.status === "driver_assigned") {
        setMessage("Driver assigned");
      } else {
        setMessage("No driver found yet");
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Driver search failed");
      }
    }
  }

  useEffect(() => {
    loadRides();
    loadStats();
  }, [auth]);

  useEffect(() => {
    if (!auth || !auth.token) {
      return;
    }

    const timer = setInterval(function() {
      loadRides();
      loadStats();
    }, 5000);

    return function() {
      clearInterval(timer);
    };
  }, [auth]);

  const activeRide = rides.find(function(ride) {
    return (
      ride.status === "searching" ||
      ride.status === "driver_assigned" ||
      ride.status === "in_progress"
    );
  });

  let activeDriver = null;

  if (activeRide && activeRide.driverId) {
    activeDriver = liveDrivers.find(function(driver) {
      return driver.driverId === activeRide.driverId;
    });
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Rider Panel</h2>
        <button className="ghost-btn" onClick={getEstimate}>
          Get Fare
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-number">{stats.totalRides}</div>
          <div className="muted">Total rides</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{stats.activeRides}</div>
          <div className="muted">Active rides</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{stats.completedRides}</div>
          <div className="muted">Completed rides</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">Rs {stats.spentAmount}</div>
          <div className="muted">Booked amount</div>
        </div>
      </div>

      <div className="list-box">
        <h3>Book A Ride</h3>
        <div className="form-grid">
          <input
            name="pickupText"
            value={form.pickupText}
            onChange={handleChange}
            placeholder="pickup text"
          />
          <input
            name="pickupLat"
            value={form.pickupLat}
            onChange={handleChange}
            placeholder="pickup lat"
          />
          <input
            name="pickupLng"
            value={form.pickupLng}
            onChange={handleChange}
            placeholder="pickup lng"
          />
          <input
            name="dropText"
            value={form.dropText}
            onChange={handleChange}
            placeholder="drop text"
          />
          <input
            name="dropLat"
            value={form.dropLat}
            onChange={handleChange}
            placeholder="drop lat"
          />
          <input
            name="dropLng"
            value={form.dropLng}
            onChange={handleChange}
            placeholder="drop lng"
          />
        </div>
      </div>

      <div className="row-actions">
        <button className="primary-btn" onClick={bookRide}>
          Book Ride
        </button>
        <button className="ghost-btn" onClick={loadRides}>
          Refresh Rides
        </button>
      </div>

      {estimate ? (
        <div className="mini-box">
          <strong>Fare:</strong> Rs {estimate.fare} <strong>Distance:</strong>{" "}
          {estimate.distanceKm} km
        </div>
      ) : null}

      {message ? <p className="message">{message}</p> : null}

      {activeRide ? (
        <div className="list-box">
          <h3>Current Ride</h3>
          <div className="mini-box">
            <p>
              <strong>{activeRide.pickupText}</strong> to <strong>{activeRide.dropText}</strong>
            </p>
            <p className="muted">
              {activeRide.status} | Rs {activeRide.fare} | {activeRide.distanceKm} km
            </p>
            {activeRide.driverName ? (
              <p className="muted">
                Driver: {activeRide.driverName} | {activeRide.driverVehicleType || "cab"}
              </p>
            ) : (
              <p className="muted">Waiting for driver</p>
            )}
            {activeDriver ? (
              <p className="muted">
                Driver live: {activeDriver.lat?.toFixed?.(4)}, {activeDriver.lng?.toFixed?.(4)}
              </p>
            ) : null}
            {activeDriver && activeDriver.updatedAt ? (
              <p className="muted">Location updated: {formatTime(activeDriver.updatedAt)}</p>
            ) : null}
            {getRideTimeText(activeRide) ? (
              <p className="time-text">{getRideTimeText(activeRide)}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="list-box">
        <h3>My Rides</h3>
        {rides.length === 0 ? <p className="muted">No rides yet</p> : null}
        {rides.map(function(ride) {
          const rideId = ride._id || ride.id;

          return (
            <div className="list-item" key={rideId}>
              <div>
                <strong>{ride.pickupText}</strong> to <strong>{ride.dropText}</strong>
                <div className="muted">
                  {ride.status} | Rs {ride.fare} | {ride.distanceKm} km
                </div>
                {ride.driverName ? (
                  <div className="muted">
                    Driver: {ride.driverName} | {ride.driverVehicleType || "cab"}
                  </div>
                ) : null}
                {getRideTimeText(ride) ? (
                  <div className="time-text">{getRideTimeText(ride)}</div>
                ) : null}
              </div>

              <div className="inline-actions">
                {ride.status === "searching" ? (
                  <button
                    className="ghost-btn"
                    onClick={function() {
                      retryDriverSearch(rideId);
                    }}
                  >
                    Find Driver
                  </button>
                ) : null}

                {ride.status === "searching" || ride.status === "driver_assigned" ? (
                  <button
                    className="ghost-btn"
                    onClick={function() {
                      cancelRide(rideId);
                    }}
                  >
                    Cancel Ride
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="list-box">
        <h3>Nearby Drivers</h3>
        {nearbyDrivers.length === 0 ? (
          <p className="muted">No nearby drivers found yet</p>
        ) : null}
        {nearbyDrivers.map(function(driver) {
          return (
            <div className="list-item" key={driver.driverId}>
              <div>
                <strong>{driver.name || "Unnamed driver"}</strong>
                <div className="muted">{driver.vehicleType || "cab"}</div>
              </div>
              <div className="muted">{driver.distanceKm} km away</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RiderPanel;
