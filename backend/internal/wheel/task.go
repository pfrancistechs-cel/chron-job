package wheel

import "time"

type TaskStatus string

const (
	StatusScheduled TaskStatus = "SCHEDULED"
	StatusExecuting TaskStatus = "EXECUTING"
	StatusCompleted TaskStatus = "COMPLETED"
	StatusFailedDLQ TaskStatus = "FAILED_DLQ"
)

type Task struct {
	ID         string     `json:"id"`
	Topic      string     `json:"topic"`
	ExecuteAt  time.Time  `json:"execute_at"`
	Payload    string     `json:"payload"`
	Retries    int        `json:"retries"`
	MaxRetries int        `json:"max_retries"`
	Status     TaskStatus `json:"status"`
	SlotIndex  int        `json:"slot_index"`
}

<!-- // Circular doubly-linked slots for O(1) task removal -->
