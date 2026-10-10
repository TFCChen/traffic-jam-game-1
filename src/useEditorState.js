import { useEffect, useRef, useState } from "react";
import { cloneCars } from "./gameEngine.js";
import { loadDraft, saveDraft } from "./storage.js";
export function useEditorState(mode) {
  const [initial] = useState(loadDraft),
    draft = useRef(initial);
  const [editorTitle, setEditorTitle] = useState(initial?.title ?? ""),
    [editorCars, setEditorCars] = useState(initial?.cars ?? []),
    [editingCustomId, setEditingCustomId] = useState(initial?.id ?? null);
  const [editorStart, setEditorStart] = useState(null),
    [editorConflict, setEditorConflict] = useState(null),
    [editorValidation, setEditorValidation] = useState(null),
    [editorHistory, setEditorHistory] = useState([]),
    [editorFuture, setEditorFuture] = useState([]);
  useEffect(() => {
    if (!editorConflict) return;
    const timer = setTimeout(() => setEditorConflict(null), 1800);
    return () => clearTimeout(timer);
  }, [editorConflict]);
  useEffect(() => {
    if (mode !== "editor") return;
    const value = { cars: editorCars, title: editorTitle, id: editingCustomId };
    draft.current = value;
    saveDraft(value);
  }, [editorCars, editorTitle, editingCustomId, mode]);
  function resetSelection() {
    setEditorConflict(null);
    setEditorValidation(null);
    setEditorStart(null);
  }
  function editCars(next) {
    setEditorHistory((h) => [...h, cloneCars(editorCars)].slice(-100));
    setEditorFuture([]);
    setEditorCars(next);
    resetSelection();
  }
  function undoEditor() {
    if (!editorHistory.length) return;
    setEditorFuture((f) => [cloneCars(editorCars), ...f]);
    setEditorCars(editorHistory.at(-1));
    setEditorHistory((h) => h.slice(0, -1));
    resetSelection();
  }
  function redoEditor() {
    if (!editorFuture.length) return;
    setEditorHistory((h) => [...h, cloneCars(editorCars)]);
    setEditorCars(editorFuture[0]);
    setEditorFuture((f) => f.slice(1));
    resetSelection();
  }
  return {
    draft,
    editorTitle,
    setEditorTitle,
    editorCars,
    setEditorCars,
    editingCustomId,
    setEditingCustomId,
    editorStart,
    editorConflict,
    setEditorConflict,
    setEditorStart,
    editorValidation,
    setEditorValidation,
    editorHistory,
    setEditorHistory,
    editorFuture,
    setEditorFuture,
    editCars,
    undoEditor,
    redoEditor,
  };
}
