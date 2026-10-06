package lease

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

type WorkerLease struct {
	WorkerID     string    `json:"worker_id"`
	FencingToken uint64    `json:"fencing_token"`
	AcquiredAt   time.Time `json:"acquired_at"`
	ExpiresAt    time.Time `json:"expires_at"`
	IsActive     bool      `json:"is_active"`
}

type Coordinator struct {
	mu           sync.RWMutex
	tokenCounter uint64
	activeLease  *WorkerLease
	workers      []string
}

func NewCoordinator() *Coordinator {
	return &Coordinator{
		workers: []string{"worker-pod-alpha", "worker-pod-beta", "worker-pod-gamma"},
	}
}

func (c *Coordinator) AcquireLease(workerID string, ttl time.Duration) (*WorkerLease, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	if c.activeLease != nil && c.activeLease.IsActive && now.Before(c.activeLease.ExpiresAt) && c.activeLease.WorkerID != workerID {
		return nil, fmt.Errorf("lease currently held by %s with fencing token #%d", c.activeLease.WorkerID, c.activeLease.FencingToken)
	}

	newToken := atomic.AddUint64(&c.tokenCounter, 1)
	lease := &WorkerLease{
		WorkerID:     workerID,
		FencingToken: newToken,
		AcquiredAt:   now,
		ExpiresAt:    now.Add(ttl),
		IsActive:     true,
	}

	c.activeLease = lease
	return lease, nil
}

func (c *Coordinator) CurrentLease() *WorkerLease {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.activeLease
}

func (c *Coordinator) Workers() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.workers
}


<!-- // Atomic increment optimized for high worker turnover
 -->

<!-- // Lease heartbeat renewal loop -->
