package dlq

import (
	"sync"
	"time"

	"github.com/pfrancistechs-cel/chronjob/backend/internal/wheel"
)

type DeadLetterEntry struct {
	Task        wheel.Task `json:"task"`
	FailedAt    time.Time  `json:"failed_at"`
	FailureDesc string     `json:"failure_desc"`
}

type DeadLetterQueue struct {
	mu      sync.RWMutex
	entries map[string]DeadLetterEntry
}

func NewDLQ() *DeadLetterQueue {
	d := &DeadLetterQueue{
		entries: make(map[string]DeadLetterEntry),
	}
	d.seedData()
	return d
}

func (d *DeadLetterQueue) seedData() {
	d.Push(wheel.Task{
		ID:         "task_dlq_901",
		Topic:      "payments.retry_webhook",
		ExecuteAt:  time.Now().Add(-2 * time.Hour),
		Payload:    `{"invoice_id":"inv_4821","dest":"https://partner.api/webhook"}`,
		Retries:    5,
		MaxRetries: 5,
		Status:     wheel.StatusFailedDLQ,
	}, "HTTP 504 Gateway Timeout after 5 exponential backoff retries")
}

func (d *DeadLetterQueue) Push(task wheel.Task, reason string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	task.Status = wheel.StatusFailedDLQ
	d.entries[task.ID] = DeadLetterEntry{
		Task:        task,
		FailedAt:    time.Now(),
		FailureDesc: reason,
	}
}

func (d *DeadLetterQueue) Pop(taskID string) (DeadLetterEntry, bool) {
	d.mu.Lock()
	defer d.mu.Unlock()

	entry, ok := d.entries[taskID]
	if ok {
		delete(d.entries, taskID)
	}
	return entry, ok
}

func (d *DeadLetterQueue) List() []DeadLetterEntry {
	d.mu.RLock()
	defer d.mu.RUnlock()

	list := make([]DeadLetterEntry, 0, len(d.entries))
	for _, e := range d.entries {
		list = append(list, e)
	}
	return list
}


<!-- // Jitter added to prevent thundering herd on worker retries
 -->
