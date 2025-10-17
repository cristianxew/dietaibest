"use client";

import { useState, useEffect, useCallback } from "react";

interface UndoState<T> {
  past: T[];
  present: T | null;
  future: T[];
}

interface UseUndoOptions {
  maxHistorySize?: number;
}

export function useUndo<T>(
  initialState: T | null = null,
  options: UseUndoOptions = {}
) {
  const { maxHistorySize = 20 } = options;

  const [state, setState] = useState<UndoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  // Set new state and add to history
  const set = useCallback(
    (newPresent: T) => {
      setState((currentState) => {
        const newPast = currentState.present !== null
          ? [...currentState.past, currentState.present].slice(-maxHistorySize)
          : currentState.past;

        return {
          past: newPast,
          present: newPresent,
          future: [], // Clear future when setting new state
        };
      });
    },
    [maxHistorySize]
  );

  // Undo to previous state
  const undo = useCallback(() => {
    setState((currentState) => {
      if (currentState.past.length === 0) return currentState;

      const previous = currentState.past[currentState.past.length - 1];
      const newPast = currentState.past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: currentState.present !== null
          ? [currentState.present, ...currentState.future]
          : currentState.future,
      };
    });
  }, []);

  // Redo to next state
  const redo = useCallback(() => {
    setState((currentState) => {
      if (currentState.future.length === 0) return currentState;

      const next = currentState.future[0];
      const newFuture = currentState.future.slice(1);

      return {
        past: currentState.present !== null
          ? [...currentState.past, currentState.present]
          : currentState.past,
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // Reset to initial state
  const reset = useCallback((newInitialState?: T) => {
    setState({
      past: [],
      present: newInitialState !== undefined ? newInitialState : initialState,
      future: [],
    });
  }, [initialState]);

  // Clear history but keep current state
  const clearHistory = useCallback(() => {
    setState((currentState) => ({
      past: [],
      present: currentState.present,
      future: [],
    }));
  }, []);

  // Keyboard shortcut support (Ctrl+Z / Cmd+Z for undo, Ctrl+Shift+Z / Cmd+Shift+Z for redo)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (modifierKey && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) {
          undo();
        }
      } else if (
        modifierKey &&
        (event.key === "Z" || (event.shiftKey && event.key === "z"))
      ) {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    clearHistory,
  };
}
