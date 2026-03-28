package store

import (
	"math"
	"sort"
	"sync"
	"time"

	"uber-realtime/internal/model"
)

type LocationStore struct {
	mu      sync.RWMutex
	drivers map[string]model.DriverLocation
}

func NewLocationStore() *LocationStore {
	return &LocationStore{
		drivers: make(map[string]model.DriverLocation),
	}
}

func (s *LocationStore) Save(input model.DriverLocation) model.DriverLocation {
	s.mu.Lock()
	defer s.mu.Unlock()

	input.UpdatedAt = time.Now()
	s.drivers[input.DriverID] = input

	return input
}

func (s *LocationStore) Delete(driverID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.drivers[driverID]; !ok {
		return false
	}

	delete(s.drivers, driverID)
	return true
}

func (s *LocationStore) All() []model.DriverLocation {
	s.mu.RLock()
	defer s.mu.RUnlock()

	drivers := make([]model.DriverLocation, 0, len(s.drivers))
	for _, driver := range s.drivers {
		drivers = append(drivers, driver)
	}

	return drivers
}

func (s *LocationStore) Nearby(lat float64, lng float64, radius float64) []model.NearbyDriver {
	s.mu.RLock()
	defer s.mu.RUnlock()

	drivers := make([]model.NearbyDriver, 0)

	for _, driver := range s.drivers {
		distance := distanceKm(lat, lng, driver.Lat, driver.Lng)
		if radius > 0 && distance > radius {
			continue
		}

		drivers = append(drivers, model.NearbyDriver{
			DriverID:    driver.DriverID,
			Name:        driver.Name,
			VehicleType: driver.VehicleType,
			Lat:         driver.Lat,
			Lng:         driver.Lng,
			DistanceKm:  round(distance),
		})
	}

	sort.Slice(drivers, func(i int, j int) bool {
		return drivers[i].DistanceKm < drivers[j].DistanceKm
	})

	return drivers
}

func distanceKm(lat1 float64, lng1 float64, lat2 float64, lng2 float64) float64 {
	const earthRadius = 6371

	dLat := toRad(lat2 - lat1)
	dLng := toRad(lng2 - lng1)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRad(lat1))*math.Cos(toRad(lat2))*
			math.Sin(dLng/2)*math.Sin(dLng/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadius * c
}

func toRad(value float64) float64 {
	return value * math.Pi / 180
}

func round(value float64) float64 {
	return math.Round(value*100) / 100
}
