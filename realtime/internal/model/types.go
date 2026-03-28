package model

import "time"

type DriverLocation struct {
	DriverID    string    `json:"driverId"`
	Name        string    `json:"name"`
	VehicleType string    `json:"vehicleType"`
	Lat         float64   `json:"lat"`
	Lng         float64   `json:"lng"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type NearbyDriver struct {
	DriverID    string  `json:"driverId"`
	Name        string  `json:"name"`
	VehicleType string  `json:"vehicleType"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	DistanceKm  float64 `json:"distanceKm"`
}
