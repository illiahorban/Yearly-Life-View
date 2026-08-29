import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DayTemplate } from "../../types/calendar";
import { LangContext } from "../../constants/i18n";
import { useIsMobile } from "../../hooks/use-mobile";
import { useVisualViewport } from "../../hooks/use-visual-viewport";
import { makeId, newTimestamps } from "../../utils/storage";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { TrashIcon, GripIcon, CheckIcon } from "../icons/Icons";

export function DayTemplatesModal({
  dark,
  modalBg,
  templates,
  onSave,
  onApply,
  onClose,
  onCloseAll,
  prefillItems,
}: {
  dark: boolean;
  modalBg: string;
  templates: DayTemplate[];
  onSave: (templates: DayTemplate[]) => void;
  onApply?: (tpl: DayTemplate) => void;
  onClose: () => void;
  onCloseAll?: () => void;
  prefillItems?: string[];
}) {
  const { t } = React.useContext(LangContext);
  const isMobile = useIsMobile();
  const { height: vvHeight, offsetTop: vvOffsetTop, isKeyboardOpen } = useVisualViewport();

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const borderColor = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
  const inputBg = dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.7)";
  const inputStyle: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    color: "var(--text)",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    width: "100%",
  };

  // local draft of templates
  const [draft, setDraft] = useState<DayTemplate[]>(() =>
    templates.map((t) => ({ ...t, items: [...t.items] })),
  );
  const draftRef = useRef(draft);
  const commitDraft = (next: DayTemplate[]) => {
    draftRef.current = next;
    setDraft(next);
    onSave(next);
  };
  const [editingId, setEditingId] = useState<string | null>(() =>
    prefillItems ? "__new__" : null,
  );
  // form state for create / edit
  const [formName, setFormName] = useState("");
  const formNameRef = useRef(formName);
  const [formItems, setFormItems] = useState<string[]>(() => {
    if (prefillItems && prefillItems.length > 0) {
      return [...prefillItems];
    }
    return [""];
  });
  const formItemsRef = useRef(formItems);
  const commitFormName = (next: string) => {
    formNameRef.current = next;
    setFormName(next);
  };
  const commitFormItems = (next: string[]) => {
    formItemsRef.current = next;
    setFormItems(next);
  };
  const startNew = () => {
    setEditingId("__new__");
    commitFormName("");
    commitFormItems([""]);
  };
  const startEdit = (tpl: DayTemplate) => {
    setEditingId(tpl.id);
    commitFormName(tpl.name);
    commitFormItems(tpl.items.length > 0 ? [...tpl.items] : [""]);
  };
  const cancelEdit = () => setEditingId(null);

  const saveForm = () => {
    const name = formNameRef.current.trim();
    if (!name) return;
    const items = formItemsRef.current
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (items.length === 0) return;
    if (editingId === "__new__") {
      const newTpl: DayTemplate = {
        id: makeId(),
        name,
        items,
        ...newTimestamps(),
        isDeleted: false,
      };
      commitDraft([...draftRef.current, newTpl]);
    } else {
      const updated = draftRef.current.map((tpl) =>
        tpl.id === editingId ? { ...tpl, name, items } : tpl,
      );
      commitDraft(updated);
    }
    setEditingId(null);
  };
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteTpl = (id: string) => {
    commitDraft(draftRef.current.filter((tpl) => tpl.id !== id));
    setConfirmDeleteId(null);
  };
  const addItem = () => {
    if (formItemsRef.current.length < 10)
      commitFormItems([...formItemsRef.current, ""]);
  };
  const removeItem = (i: number) =>
    commitFormItems(formItemsRef.current.filter((_, j) => j !== i));
  const updateItem = (i: number, v: string) =>
    commitFormItems(formItemsRef.current.map((s, j) => (j === i ? v : s)));

  const editing = editingId !== null;

  return (
    <motion.div
      initial={false}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ overflowY: "auto", overscrollBehavior: "contain" }}
      onClick={onCloseAll ?? onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.32)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(92vw,400px)",
          background: modalBg,
          backdropFilter: "saturate(180%) blur(24px)",
          WebkitBackdropFilter: "saturate(180%) blur(24px)",
          borderRadius: 22,
          boxShadow: `0 8px 48px rgba(0,0,0,0.26), inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)"}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100dvh - 2rem)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {onApply && (
              <button
                onClick={onClose}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 99,
                  background: "rgba(128,128,128,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                }}
              >
                {t("settings")}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text)",
                  marginTop: 2,
                }}
              >
                {t("templatesTitle")}
              </div>
            </div>
          </div>
          <button
            onClick={onCloseAll ?? onClose}
            style={{
              width: 26,
              height: 26,
              borderRadius: 99,
              background: "rgba(128,128,128,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              fontSize: 14,
              border: "none",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            overflowY: "auto",
            overscrollBehavior: "contain",
            flex: 1,
            padding: "12px 20px 16px",
          }}
        >
          <div
            style={{
              visibility: editing ? "visible" : "hidden",
              opacity: editing ? 1 : 0,
              pointerEvents: editing ? "auto" : "none",
              position: editing ? "relative" : "absolute",
              inset: editing ? undefined : 0,
              width: "100%",
            }}
          >
            {/* ── Edit / Create form ── */}
            <div>
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-tertiary)",
                    marginBottom: 4,
                  }}
                >
                  {t("newTemplate")}
                </div>
                <input
                  value={formName}
                  onChange={(e) => commitFormName(e.target.value)}
                  placeholder={t("templateNamePlaceholder")}
                  style={{ ...inputStyle, fontSize: 13, fontWeight: 600 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveForm();
                    }
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {formItems.map((item, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `1.5px solid ${borderColor}`,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--text-tertiary)",
                          fontWeight: 600,
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <input
                      value={item}
                      onChange={(e) => updateItem(i, e.target.value)}
                      placeholder={`${t("goal")} ${i + 1}`}
                      style={{ ...inputStyle, flex: 1 }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (
                            i === formItems.length - 1 &&
                            formItems.length < 10
                          )
                            addItem();
                        }
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    {formItems.length > 1 && (
                      <button
                        onClick={() => removeItem(i)}
                        style={{
                          width: 18,
                          height: 18,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "#ff3b30",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {formItems.length < 10 && (
                <button
                  onClick={addItem}
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "#007aff",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "inherit",
                    fontWeight: 600,
                  }}
                >
                  + {t("addTemplateItem")}
                </button>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  onClick={cancelEdit}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    borderRadius: 9,
                    border: `1px solid ${borderColor}`,
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={saveForm}
                  disabled={
                    !formName.trim() || formItems.every((s) => !s.trim())
                  }
                  style={{
                    flex: 2,
                    padding: "7px 0",
                    borderRadius: 9,
                    border: "none",
                    background: "#007aff",
                    color: "white",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    opacity:
                      !formName.trim() || formItems.every((s) => !s.trim())
                        ? 0.4
                        : 1,
                  }}
                >
                  {t("saveTemplate")}
                </button>
              </div>
            </div>
          </div>
          <div
            style={{
              visibility: editing ? "hidden" : "visible",
              opacity: editing ? 0 : 1,
              pointerEvents: editing ? "none" : "auto",
            }}
          >
            {/* ── Templates list ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {draft.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 0",
                    color: "var(--text-tertiary)",
                    fontSize: 13,
                  }}
                >
                  {t("noTemplates")}
                </div>
              ) : (
                draft.map((tpl) => (
                  <div
                    key={tpl.id}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${borderColor}`,
                      padding: "10px 12px",
                      background: dark
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--text)",
                        }}
                      >
                        {tpl.name}
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {onApply && (
                          <button
                            onClick={() => onApply(tpl)}
                            style={{
                              height: 24,
                              padding: "0 9px",
                              borderRadius: 5,
                              border: "none",
                              background: "#007aff",
                              cursor: "pointer",
                              color: "white",
                              fontSize: 11,
                              fontWeight: 700,
                              fontFamily: "inherit",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {t("applyTemplate")}
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(tpl)}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 5,
                            border: `1px solid ${borderColor}`,
                            background: "transparent",
                            cursor: "pointer",
                            color: "var(--text-secondary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(tpl.id)}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 5,
                            border: `1px solid rgba(255,59,48,0.3)`,
                            background: "transparent",
                            cursor: "pointer",
                            color: "#ff3b30",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      {tpl.items
                        .filter((s) => s.trim())
                        .map((item, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 99,
                                background: "var(--text-tertiary)",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-secondary)",
                              }}
                            >
                              {item}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              )}
              {draft.length < 20 && (
                <button
                  onClick={startNew}
                  style={{
                    width: "100%",
                    padding: "9px 0",
                    borderRadius: 10,
                    border: `1.5px dashed ${dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)"}`,
                    background: "transparent",
                    color: "#007aff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    marginTop: 2,
                  }}
                >
                  + {t("newTemplate")}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) deleteTpl(confirmDeleteId);
        }}
        message={t("deleteTplConfirm")}
        confirmLabel={t("remove")}
        dark={dark}
      />
    </motion.div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────