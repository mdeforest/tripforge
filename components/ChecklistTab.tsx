"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Package, ChevronDown, Info } from "lucide-react";
import type { ChecklistItem } from "@/types/trip";

interface ChecklistTabProps {
  tripId: string;
  initialItems: ChecklistItem[];
  readOnly?: boolean;
}

const CATEGORIES = [
  "Clothing",
  "Footwear",
  "Toiletries",
  "Electronics",
  "Documents",
  "Health & Safety",
  "Accessories",
  "Other",
];

/**
 * Groups an array of checklist items by category.
 * Preserves insertion order within each category.
 */
function groupByCategory(items: ChecklistItem[]): Map<string, ChecklistItem[]> {
  const map = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const group = map.get(item.category) ?? [];
    group.push(item);
    map.set(item.category, group);
  }
  return map;
}

/**
 * Packing checklist tab.
 *
 * - Items are grouped by category and rendered with checkboxes.
 * - Check/uncheck uses optimistic UI: the local state updates immediately
 *   and a background PATCH request syncs to the server.
 * - Custom items can be added via the form at the bottom.
 * - Items can be deleted with the trash icon (X).
 * - Progress indicator shows "X of Y packed".
 */
export function ChecklistTab({ tripId, initialItems, readOnly = false }: ChecklistTabProps) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [isAdding, setIsAdding] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [tooltipId, setTooltipId] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  // Close the category dropdown when clicking outside it
  useEffect(() => {
    if (!categoryOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [categoryOpen]);

  const checkedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const grouped = groupByCategory(items);

  // ── Check / uncheck ──────────────────────────────────────────────────────────

  function handleToggle(itemId: string, checked: boolean) {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, checked } : i))
    );

    fetch(`/api/trips/${tripId}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId, checked }),
    }).catch(() => {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, checked: !checked } : i))
      );
    });
  }

  // ── Reset all ────────────────────────────────────────────────────────────────

  function handleReset() {
    const checkedIds = items.filter((i) => i.checked).map((i) => i.id);
    if (checkedIds.length === 0) return;

    // Optimistic: uncheck everything
    setItems((prev) => prev.map((i) => ({ ...i, checked: false })));

    // Sync each previously-checked item to the server in parallel
    Promise.all(
      checkedIds.map((id) =>
        fetch(`/api/trips/${tripId}/checklist`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, checked: false }),
        })
      )
    ).catch(() => {
      // Revert all on network failure
      setItems((prev) =>
        prev.map((i) => ({ ...i, checked: checkedIds.includes(i.id) ? true : i.checked }))
      );
    });
  }

  // ── Add custom item ──────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;

    setIsAdding(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, category: newCategory }),
      });

      if (res.ok) {
        const { item } = (await res.json()) as { item: ChecklistItem };
        setItems((prev) => [...prev, item]);
        setNewLabel("");
        labelInputRef.current?.focus();
      }
    } finally {
      setIsAdding(false);
    }
  }

  // ── Delete item ──────────────────────────────────────────────────────────────

  function handleDelete(itemId: string) {
    // Optimistic remove
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    fetch(`/api/trips/${tripId}/checklist`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    }).catch(() => {
      // Revert: we don't have the item anymore, so re-fetch isn't trivial.
      // Best effort — user can reload to restore.
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-ink">Packing List</h2>
        {totalCount > 0 && (
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-medium text-muted"
              aria-label={`${checkedCount} of ${totalCount} items packed`}
            >
              {checkedCount} / {totalCount} packed
            </span>
            {checkedCount > 0 && (
              <button
                onClick={handleReset}
                className="text-xs font-medium text-muted hover:text-rust transition-colors"
                aria-label="Uncheck all items"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div
          role="progressbar"
          aria-valuenow={checkedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label="Packing progress"
          className="h-1.5 w-full rounded-full bg-parchment-dark overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-rust transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Add custom item form — hidden in readOnly mode */}
      {!readOnly && (
        <form
          onSubmit={handleAdd}
          className="pb-2 border-b border-parchment-dark space-y-2"
          aria-label="Add custom item"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Add item</p>
          <div className="flex gap-2">
            <div ref={categoryRef} className="relative w-28 shrink-0">
              <button
                type="button"
                aria-label="Category"
                aria-expanded={categoryOpen}
                aria-haspopup="listbox"
                onClick={() => setCategoryOpen((o) => !o)}
                className="w-full flex items-center gap-1 rounded-lg border border-parchment-dark bg-white pl-3 pr-2 py-2 text-sm text-ink hover:border-parchment-deep focus:outline-none focus:ring-2 focus:ring-rust/40 transition-colors"
              >
                <span className="flex-1 truncate text-left">{newCategory}</span>
                <ChevronDown
                  className={[
                    "h-3.5 w-3.5 text-muted transition-transform duration-150",
                    categoryOpen ? "rotate-180" : "",
                  ].join(" ")}
                  aria-hidden="true"
                />
              </button>

              {categoryOpen && (
                <ul
                  role="listbox"
                  aria-label="Category"
                  className="absolute left-0 top-full mt-1 z-30 min-w-full rounded-lg border border-parchment-dark bg-white shadow-md py-1 overflow-hidden"
                >
                  {CATEGORIES.map((cat) => (
                    <li
                      key={cat}
                      role="option"
                      aria-selected={cat === newCategory}
                      onMouseDown={(e) => {
                        e.preventDefault(); // prevent blur on label input
                        setNewCategory(cat);
                        setCategoryOpen(false);
                      }}
                      className={[
                        "px-3 py-1.5 text-sm cursor-pointer select-none",
                        cat === newCategory
                          ? "bg-parchment text-rust font-medium"
                          : "text-ink hover:bg-parchment",
                      ].join(" ")}
                    >
                      {cat}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input
              ref={labelInputRef}
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Item name…"
              aria-label="New item name"
              className="flex-1 min-w-0 rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-rust/40"
            />
            <button
              type="submit"
              disabled={!newLabel.trim() || isAdding}
              aria-label="Add item"
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-rust px-3 py-2 text-sm font-medium text-white hover:bg-rust-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Package className="h-10 w-10 text-parchment-deep mb-3" aria-hidden="true" />
          <p className="text-sm text-muted">No items yet. Add your first item above.</p>
        </div>
      )}

      {/* Items grouped by category */}
      {Array.from(grouped.entries()).map(([category, categoryItems]) => (
        <section key={category} aria-labelledby={`category-${category}`}>
          <h3
            id={`category-${category}`}
            className="text-xs font-semibold uppercase tracking-wider text-muted mb-2"
          >
            {category}
          </h3>
          <ul className="space-y-1">
            {categoryItems.map((item) => (
              <li key={item.id} className="relative">
                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white border border-parchment-dark hover:border-parchment-deep transition-colors">
                  <input
                    type="checkbox"
                    id={`item-${item.id}`}
                    checked={item.checked}
                    onChange={(e) => handleToggle(item.id, e.target.checked)}
                    disabled={readOnly}
                    className="h-4 w-4 rounded border-parchment-deep text-rust accent-rust shrink-0"
                    aria-label={item.label}
                  />
                  <label
                    htmlFor={`item-${item.id}`}
                    className={[
                      "flex-1 text-sm cursor-pointer select-none",
                      item.checked ? "line-through text-muted" : "text-ink",
                    ].join(" ")}
                  >
                    {item.label}
                  </label>
                  {item.reason && (
                    <button
                      type="button"
                      onClick={() => setTooltipId(tooltipId === item.id ? null : item.id)}
                      aria-label={`Why: ${item.label}`}
                      aria-expanded={tooltipId === item.id}
                      className="shrink-0 text-parchment-deep hover:text-sky transition-colors p-0.5"
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      aria-label={`Delete ${item.label}`}
                      className="shrink-0 text-parchment-deep hover:text-rust transition-colors p-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
                {tooltipId === item.id && item.reason && (
                  <div
                    role="tooltip"
                    className="absolute left-0 right-0 z-10 mt-1 rounded-lg border border-sky/20 bg-ink px-3 py-2 text-xs text-cream shadow-lg"
                  >
                    {item.reason}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
