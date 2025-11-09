# React Hooks - Common Pitfalls & Solutions

**Last Updated:** 2025-11-09

## Related Documentation
- [Recipe Import System](../System/recipe_import_system.md) - Real-world examples

---

## 1. isMountedRef Must Be Set in useEffect

**Problem:** Setting `isMountedRef.current = true` in `useRef()` initialization doesn't work after Fast Refresh.

**Wrong:**
```typescript
const isMountedRef = useRef(true); // ❌ Breaks after Fast Refresh
```

**Correct:**
```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  isMountedRef.current = true; // ✅ Set in effect
  return () => {
    isMountedRef.current = false;
  };
}, []);
```

**Why:** Fast Refresh remounts components but doesn't re-initialize refs. Setting in `useEffect` ensures synchronization.

---

## 2. EventSource Cleanup

**Problem:** Multiple EventSource connections accumulate, orphaned handlers fire on stale data.

**Solution:**
```typescript
const eventSourceRef = useRef<EventSource | null>(null);

// Close old before creating new
if (eventSourceRef.current) {
  eventSourceRef.current.close();
  eventSourceRef.current = null; // Immediately null
}

const eventSource = new EventSource(url);
eventSourceRef.current = eventSource;

// Verify handler is current
eventSource.onmessage = (event) => {
  if (eventSourceRef.current === eventSource) {
    // Safe to process
  }
};

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };
}, []);
```

---

## 3. AbortController for Fetch

**Problem:** Fetch continues after unmount, causes state update warnings.

**Solution:**
```typescript
const abortControllerRef = useRef<AbortController | null>(null);

abortControllerRef.current = new AbortController();

const response = await fetch(url, {
  signal: abortControllerRef.current.signal,
});

// Cleanup
if (abortControllerRef.current) {
  abortControllerRef.current.abort();
  abortControllerRef.current = null;
}
```

---

## 4. Empty Dependency Arrays Cause Stale Closures

**Problem:** `useCallback` with empty deps captures stale values.

**Wrong:**
```typescript
const callback = useCallback(() => {
  setUploadState(prev => ...); // ❌ Captures old setUploadState
}, []); // Empty deps = stale closure
```

**Correct:**
```typescript
// Option 1: Include dependencies
const callback = useCallback(() => {
  if (isMountedRef.current) {
    setUploadState(prev => ...);
  }
}, [isMountedRef]); // ✅ Include deps

// Option 2: No useCallback (simpler)
const callback = async () => {
  if (isMountedRef.current) {
    setUploadState(prev => ...);
  }
};
```

---

## 5. State Updates on Unmounted Components

**Always check before updating:**
```typescript
if (isMountedRef.current) {
  setUploadState(prev => ({...prev, status: "success"}));
}
```

---

## Quick Checklist

- [ ] Set `isMountedRef.current = true` in `useEffect`, not initialization
- [ ] Close EventSource before creating new one
- [ ] Set refs to `null` immediately after cleanup
- [ ] Verify handler is current before processing events
- [ ] Use AbortController for fetch requests
- [ ] Check `isMountedRef.current` before all state updates
- [ ] Include all dependencies in `useCallback` deps array

---

**See Also:** [Recipe Import System](../System/recipe_import_system.md) for production examples
