package main

import (
	"log"
	"net/http"

	"uber-realtime/internal/handler"
	"uber-realtime/internal/store"
)

func main() {
	locationStore := store.NewLocationStore()
	locationHandler := handler.NewLocationHandler(locationStore)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", locationHandler.Health)
	mux.HandleFunc("/drivers/location", locationHandler.UpdateLocation)
	mux.HandleFunc("/drivers/nearby", locationHandler.NearbyDrivers)
	mux.HandleFunc("/drivers/", locationHandler.RemoveDriver)
	mux.HandleFunc("/ws", locationHandler.ServeWS)

	log.Println("Realtime service running on port 8080")
	err := http.ListenAndServe(":8080", withCORS(mux))
	if err != nil {
		log.Fatal(err)
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
