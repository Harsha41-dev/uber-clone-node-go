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

function RiderPanel(props) {
  const auth = props.auth;

  const [form, setForm] = useState(initialRide);
  const [estimate, setEstimate] = useState(null);
  const [rides, setRides] = useState([]);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [message, setMessage] = useState("");

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

  async function getEstimate() {
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

    try {
      const response = await api.post("/rides", form);
      const newRide = response.data.ride;
      const drivers = response.data.nearbyDrivers || [];

      setNearbyDrivers(drivers);
      setEstimate({
        fare: newRide.fare,
        distanceKm: newRide.distanceKm
      });

      if (newRide.driverId) {
        setMessage("Driver assigned");
      } else {
        setMessage("Ride created, waiting for driver");
      }

      setRides(function(prevRides) {
        return [newRide, ...prevRides];
      });
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Ride booking failed");
      }
    }
  }

  useEffect(() => {
    loadRides();
  }, [auth]);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Rider Panel</h2>
        <button className="ghost-btn" onClick={getEstimate}>
          Get Fare
        </button>
      </div>

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

      <div className="row-actions">
        <button className="primary-btn" onClick={bookRide}>
          Book Ride
        </button>
      </div>

      {estimate ? (
        <div className="mini-box">
          <strong>Fare:</strong> Rs {estimate.fare} <strong>Distance:</strong>{" "}
          {estimate.distanceKm} km
        </div>
      ) : null}

      {message ? <p className="message">{message}</p> : null}

      <div className="list-box">
        <h3>My Rides</h3>
        {rides.length === 0 ? <p className="muted">No rides yet</p> : null}
        {rides.map(function(ride) {
          return (
            <div className="list-item" key={ride._id || ride.id}>
              <div>
                <strong>{ride.pickupText}</strong> to <strong>{ride.dropText}</strong>
              </div>
              <div className="muted">
                {ride.status} | Rs {ride.fare} | {ride.distanceKm} km
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
              </div>
              <div className="muted">
                {driver.vehicleType || "cab"} | {driver.distanceKm} km away
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RiderPanel;
