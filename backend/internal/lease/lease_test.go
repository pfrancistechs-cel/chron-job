package lease

import (
	"testing"
	"time"
)

func TestWorkerLeaseAcquire(t *testing.T) {
	c := NewCoordinator()
	lease, err := c.AcquireLease("worker-1", 1*time.Second)
	if err != nil {
		t.Fatalf("failed to acquire lease: %v", err)
	}
	if lease.FencingToken != 1 {
		t.Fatalf("expected fencing token 1, got %d", lease.FencingToken)
	}
	if !lease.IsActive {
		t.Fatalf("expected lease to be active")
	}
}
