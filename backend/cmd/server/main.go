package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/pfrancistechs-cel/chronjob/backend/internal/dlq"
	"github.com/pfrancistechs-cel/chronjob/backend/internal/handlers"
	"github.com/pfrancistechs-cel/chronjob/backend/internal/lease"
	"github.com/pfrancistechs-cel/chronjob/backend/internal/wheel"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8087"
	}

	tw := wheel.NewTimingWheel(30, 1*time.Second) // 30-slot 1-second wheel
	lc := lease.NewCoordinator()
	_, _ = lc.AcquireLease("worker-pod-alpha", 60*time.Second)
	d := dlq.NewDLQ()

	// Seed sample tasks in wheel
	tw.Schedule(&wheel.Task{
		ID:         "task_billing_01",
		Topic:      "billing.stripe_charge_settlement",
		Payload:    `{"customer_id":"cus_8941","amount":4900}`,
		Retries:    0,
		MaxRetries: 3,
	}, 4*time.Second)

	tw.Schedule(&wheel.Task{
		ID:         "task_email_02",
		Topic:      "notifications.digest_dispatch",
		Payload:    `{"recipient":"director@enterprise.io"}`,
		Retries:    0,
		MaxRetries: 3,
	}, 12*time.Second)

	// Background ticker
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			tw.Advance()
		}
	}()

	api := handlers.NewAPI(tw, lc, d)
	mux := http.NewServeMux()

	mux.HandleFunc("/health", api.HealthHandler)
	mux.HandleFunc("/api/v1/wheel", api.GetWheelHandler)
	mux.HandleFunc("/api/v1/schedule", api.ScheduleHandler)
	mux.HandleFunc("/api/v1/tick", api.TickHandler)
	mux.HandleFunc("/api/v1/dlq", api.GetDLQHandler)
	mux.HandleFunc("/api/v1/dlq/replay", api.ReplayDLQHandler)
	mux.HandleFunc("/api/v1/lease", api.GetLeaseHandler)

	handler := handlers.EnableCORS(mux)

	serverAddr := ":" + port
	fmt.Printf("⏱️ ChronJob Timing Wheel Scheduler running on http://localhost%s\n", serverAddr)
	if err := http.ListenAndServe(serverAddr, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

