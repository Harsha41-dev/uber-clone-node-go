package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/gorilla/websocket"

	"uber-realtime/internal/model"
	"uber-realtime/internal/store"
)

type LocationHandler struct {
	store    *store.LocationStore
	upgrader websocket.Upgrader
	clients  map[*websocket.Conn]bool
	mu       sync.Mutex
}

func NewLocationHandler(store *store.LocationStore) *LocationHandler {
	return &LocationHandler{
		store: store,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		clients: make(map[*websocket.Conn]bool),
	}
}

func (h *LocationHandler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"service": "uber-realtime",
		"ok":      true,
	})
}

func (h *LocationHandler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"message": "Method not allowed"})
		return
	}

	var input model.DriverLocation
	err := json.NewDecoder(r.Body).Decode(&input)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"message": "Bad payload"})
		return
	}

	if input.DriverID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"message": "driverId is required"})
		return
	}

	driver := h.store.Save(input)
	h.broadcast()

	writeJSON(w, http.StatusOK, map[string]any{
		"driver": driver,
	})
}

func (h *LocationHandler) NearbyDrivers(w http.ResponseWriter, r *http.Request) {
	lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, _ := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	radius, _ := strconv.ParseFloat(r.URL.Query().Get("radius"), 64)

	drivers := h.store.Nearby(lat, lng, radius)
	writeJSON(w, http.StatusOK, map[string]any{
		"drivers": drivers,
	})
}

func (h *LocationHandler) RemoveDriver(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"message": "Method not allowed"})
		return
	}

	driverID := strings.TrimPrefix(r.URL.Path, "/drivers/")
	if driverID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"message": "driverId is required"})
		return
	}

	removed := h.store.Delete(driverID)
	if removed {
		h.broadcast()
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"removed": removed,
	})
}

func (h *LocationHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	h.mu.Lock()
	h.clients[conn] = true
	h.mu.Unlock()

	h.sendSnapshot(conn)

	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			h.mu.Lock()
			delete(h.clients, conn)
			h.mu.Unlock()
			conn.Close()
			return
		}
	}
}

func (h *LocationHandler) broadcast() {
	h.mu.Lock()
	defer h.mu.Unlock()

	payload := map[string]any{
		"type":    "drivers:update",
		"drivers": h.store.All(),
	}

	for conn := range h.clients {
		err := conn.WriteJSON(payload)
		if err != nil {
			conn.Close()
			delete(h.clients, conn)
		}
	}
}

func (h *LocationHandler) sendSnapshot(conn *websocket.Conn) {
	_ = conn.WriteJSON(map[string]any{
		"type":    "drivers:update",
		"drivers": h.store.All(),
	})
}

func writeJSON(w http.ResponseWriter, status int, data map[string]any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
