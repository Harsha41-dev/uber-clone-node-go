async function getNearbyDrivers(lat, lng) {
  const baseUrl = process.env.REALTIME_URL || "http://localhost:8080";

  try {
    const response = await fetch(
      `${baseUrl}/drivers/nearby?lat=${lat}&lng=${lng}&radius=5`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.drivers || [];
  } catch (error) {
    return [];
  }
}

module.exports = {
  getNearbyDrivers,
};
