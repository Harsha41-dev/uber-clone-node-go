function LiveDrivers({ drivers }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>Live Drivers</h2>
        <span className="badge">{drivers.length}</span>
      </div>

      {drivers.length === 0 ? <p className="muted">No live drivers yet</p> : null}

      {drivers.map((driver) => (
        <div className="list-item" key={driver.driverId}>
          <div>
            <strong>{driver.name || "Unnamed driver"}</strong>
            <div className="muted">{driver.vehicleType || "cab"}</div>
          </div>
          <div className="muted">
            {driver.lat?.toFixed?.(4)}, {driver.lng?.toFixed?.(4)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default LiveDrivers;
