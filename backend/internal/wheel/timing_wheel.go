package wheel

import (
	"sync"
	"time"
)

type TimingWheel struct {
	mu           sync.RWMutex
	slotCount    int
	tickDuration time.Duration
	currentSlot  int
	slots        [][]*Task
	allTasks     map[string]*Task
	totalFired   int64
}

func NewTimingWheel(slotCount int, tickDuration time.Duration) *TimingWheel {
	if slotCount <= 0 {
		slotCount = 60
	}
	if tickDuration <= 0 {
		tickDuration = 500 * time.Millisecond
	}

	slots := make([][]*Task, slotCount)
	for i := 0; i < slotCount; i++ {
		slots[i] = make([]*Task, 0)
	}

	return &TimingWheel{
		slotCount:    slotCount,
		tickDuration: tickDuration,
		currentSlot:  0,
		slots:        slots,
		allTasks:     make(map[string]*Task),
	}
}

func (tw *TimingWheel) Schedule(t *Task, delay time.Duration) int {
	tw.mu.Lock()
	defer tw.mu.Unlock()

	ticks := int(delay / tw.tickDuration)
	if ticks < 1 {
		ticks = 1
	}

	targetSlot := (tw.currentSlot + ticks) % tw.slotCount
	t.SlotIndex = targetSlot
	t.Status = StatusScheduled
	t.ExecuteAt = time.Now().Add(delay)

	tw.slots[targetSlot] = append(tw.slots[targetSlot], t)
	tw.allTasks[t.ID] = t

	return targetSlot
}

func (tw *TimingWheel) Advance() []*Task {
	tw.mu.Lock()
	defer tw.mu.Unlock()

	firedTasks := tw.slots[tw.currentSlot]
	tw.slots[tw.currentSlot] = make([]*Task, 0)

	for _, t := range firedTasks {
		t.Status = StatusCompleted
		tw.totalFired++
	}

	tw.currentSlot = (tw.currentSlot + 1) % tw.slotCount
	return firedTasks
}

func (tw *TimingWheel) CurrentSlot() int {
	tw.mu.RLock()
	defer tw.mu.RUnlock()
	return tw.currentSlot
}

func (tw *TimingWheel) SlotDistribution() []int {
	tw.mu.RLock()
	defer tw.mu.RUnlock()

	dist := make([]int, tw.slotCount)
	for i := 0; i < tw.slotCount; i++ {
		dist[i] = len(tw.slots[i])
	}
	return dist
}

func (tw *TimingWheel) AllActiveTasks() []*Task {
	tw.mu.RLock()
	defer tw.mu.RUnlock()

	list := make([]*Task, 0, len(tw.allTasks))
	for _, t := range tw.allTasks {
		list = append(list, t)
	}
	return list
}

func (tw *TimingWheel) TotalFired() int64 {
	tw.mu.RLock()
	defer tw.mu.RUnlock()
	return tw.totalFired
}


<!-- // Wheel cascade promotion logic -->
