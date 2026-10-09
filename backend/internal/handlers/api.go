package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/pfrancistechs-cel/chronjob/backend/internal/dlq"
	"github.com/pfrancistechs-cel/chronjob/backend/internal/lease"
	"github.com/pfrancistechs-cel/chronjob/backend/internal/wheel"
)

type API struct {
	Wheel       *wheel.TimingWheel
	LeaseCoord  *lease.Coordinator
	DLQ         *dlq.DeadLetterQueue
}

func NewAPI(tw *wheel.TimingWheel, lc *lease.Coordinator, d *dlq.DeadLetterQueue) *API {
	return &API{
		Wheel:      tw,
		LeaseCoord: lc,
		DLQ:        d,
	}
}

func EnableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *API) HealthHandler(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "healthy",
		"service": "chronjob-timing-wheel-scheduler",
		"version": "1.0.0",
		"moat":    "Hierarchical Hashed Timing Wheel (O(1)), monotonic fencing lease coordination & DLQ replay",
	})
}

func (a *API) GetWheelHandler(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"current_slot":      a.Wheel.CurrentSlot(),
		"slot_distribution": a.Wheel.SlotDistribution(),
		"active_tasks":      a.Wheel.AllActiveTasks(),
		"total_fired":       a.Wheel.TotalFired(),
	})
}

func (a *API) ScheduleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Topic        string `json:"topic"`
		DelaySeconds int    `json:"delay_seconds"`
		Payload      string `json:"payload"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Topic == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "topic required"})
		return
	}

	if req.DelaySeconds <= 0 {
		req.DelaySeconds = 5
	}

	taskID := fmt.Sprintf("task_%d", time.Now().UnixNano()%100000)
	t := &wheel.Task{
		ID:         taskID,
		Topic:      req.Topic,
		Payload:    req.Payload,
		Retries:    0,
		MaxRetries: 3,
	}

	targetSlot := a.Wheel.Schedule(t, time.Duration(req.DelaySeconds)*time.Second)

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"task_id":     taskID,
		"topic":       req.Topic,
		"target_slot": targetSlot,
		"delay_sec":   req.DelaySeconds,
		"status":      "SCHEDULED_IN_WHEEL",
	})
}

func (a *API) TickHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fired := a.Wheel.Advance()
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"new_current_slot": a.Wheel.CurrentSlot(),
		"fired_tasks":      fired,
		"fired_count":      len(fired),
	})
}

func (a *API) GetDLQHandler(w http.ResponseWriter, r *http.Request) {
	items := a.DLQ.List()
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"dlq_entries": items,
		"count":       len(items),
	})
}

func (a *API) ReplayDLQHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		TaskID string `json:"task_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TaskID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "task_id required"})
		return
	}

	entry, ok := a.DLQ.Pop(req.TaskID)
	if !ok {
		respondJSON(w, http.StatusNotFound, map[string]string{"error": "task not found in DLQ"})
		return
	}

	// Re-schedule into timing wheel with 2 second delay
	replayedTask := entry.Task
	replayedTask.Retries = 0
	replayedTask.Status = wheel.StatusScheduled
	slot := a.Wheel.Schedule(&replayedTask, 2*time.Second)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":      "REPLAYED_INTO_WHEEL",
		"task_id":     replayedTask.ID,
		"target_slot": slot,
	})
}

func (a *API) GetLeaseHandler(w http.ResponseWriter, r *http.Request) {
	lease := a.LeaseCoord.CurrentLease()
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"active_lease": lease,
		"workers":      a.LeaseCoord.Workers(),
	})
}

func respondJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

