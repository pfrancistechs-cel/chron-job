package wheel

import (
	"testing"
	"time"
)

func TestHashedTimingWheelScheduling(t *testing.T) {
	tw := NewTimingWheel(60, 100*time.Millisecond)
	task := &Task{
		ID: "test-task-1",
		Payload: "payload-1",
	}
	slot := tw.Schedule(task, 500*time.Millisecond)
	if slot < 0 || slot >= 60 {
		t.Fatalf("unexpected slot index %d", slot)
	}
}
