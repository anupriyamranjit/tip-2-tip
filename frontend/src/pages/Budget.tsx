import {
  createSignal,
  createResource,
  Show,
  For,
  createEffect,
} from "solid-js";
import * as api from "../lib/api";
import type { Expense } from "../lib/api";

const CATEGORY_ICONS: Record<string, string> = {
  restaurant: "\uD83C\uDF74",
  activity: "\u26F7\uFE0F",
  lodging: "\uD83C\uDFE8",
  transport: "\u2708\uFE0F",
  sightseeing: "\uD83C\uDFDB\uFE0F",
  other: "\uD83D\uDCB0",
  general: "\uD83D\uDCCD",
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Budget(props: { tripId: string; token: string }) {
  const [expenses, { refetch }] = createResource(
    () => props.tripId,
    async (id) => {
      // First sync confirmed pins, then return full list
      const result = await api.syncExpenses(props.token, id);
      return result.expenses;
    }
  );

  const [showAddModal, setShowAddModal] = createSignal(false);
  const [editingExpense, setEditingExpense] = createSignal<Expense | null>(null);
  const [filter, setFilter] = createSignal<"all" | "shared" | "personal">("all");

  const filteredExpenses = () => {
    const list = expenses() ?? [];
    if (filter() === "all") return list;
    return list.filter((e) => e.split_type === filter());
  };

  const totalShared = () =>
    (expenses() ?? [])
      .filter((e) => e.split_type === "shared")
      .reduce((sum, e) => sum + e.amount_cents, 0);

  const totalPersonal = () =>
    (expenses() ?? [])
      .filter((e) => e.split_type === "personal")
      .reduce((sum, e) => sum + e.amount_cents, 0);

  const totalAll = () =>
    (expenses() ?? []).reduce((sum, e) => sum + e.amount_cents, 0);

  const handleDelete = async (expenseId: string) => {
    try {
      await api.deleteExpense(props.token, props.tripId, expenseId);
      refetch();
    } catch (err: any) {
      console.error("Failed to delete expense:", err);
    }
  };

  const handleToggleSplit = async (expense: Expense) => {
    const newSplit = expense.split_type === "shared" ? "personal" : "shared";
    try {
      await api.updateExpense(props.token, props.tripId, expense.id, {
        split_type: newSplit,
      });
      refetch();
    } catch (err: any) {
      console.error("Failed to update split type:", err);
    }
  };

  return (
    <div class="budget-page">
      {/* Summary cards */}
      <div class="budget-summary">
        <div class="budget-summary-card budget-total">
          <span class="budget-card-label">TOTAL</span>
          <span class="budget-card-amount">{formatPrice(totalAll())}</span>
        </div>
        <div class="budget-summary-card budget-shared">
          <span class="budget-card-label">SHARED</span>
          <span class="budget-card-amount">{formatPrice(totalShared())}</span>
        </div>
        <div class="budget-summary-card budget-personal">
          <span class="budget-card-label">PERSONAL</span>
          <span class="budget-card-amount">{formatPrice(totalPersonal())}</span>
        </div>
      </div>

      {/* Actions row */}
      <div class="budget-actions">
        <div class="budget-filter-group">
          <button
            class={`budget-filter-btn ${filter() === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            class={`budget-filter-btn ${filter() === "shared" ? "active" : ""}`}
            onClick={() => setFilter("shared")}
          >
            Shared
          </button>
          <button
            class={`budget-filter-btn ${filter() === "personal" ? "active" : ""}`}
            onClick={() => setFilter("personal")}
          >
            Personal
          </button>
        </div>
        <button
          class="budget-add-btn"
          onClick={() => setShowAddModal(true)}
        >
          + Add Expense
        </button>
      </div>

      {/* Expense list */}
      <Show when={!expenses.loading} fallback={<p class="loading-text">Loading expenses...</p>}>
        <Show
          when={(filteredExpenses() ?? []).length > 0}
          fallback={
            <div class="budget-empty-state">
              <p>No expenses yet</p>
              <p class="budget-empty-hint">
                Confirmed activity pins with prices are auto-imported. You can also add expenses manually.
              </p>
            </div>
          }
        >
          <div class="budget-expense-list">
            <For each={filteredExpenses()}>
              {(expense) => (
                <div class="budget-expense-card">
                  <div class="budget-expense-icon">
                    {CATEGORY_ICONS[expense.category] || CATEGORY_ICONS.other}
                  </div>
                  <div class="budget-expense-info">
                    <div class="budget-expense-title-row">
                      <h4 class="budget-expense-title">{expense.title}</h4>
                      <span class="budget-expense-amount">
                        {formatPrice(expense.amount_cents)}
                      </span>
                    </div>
                    <div class="budget-expense-meta">
                      <span class="budget-expense-category">
                        {expense.category.toUpperCase()}
                      </span>
                      <Show when={expense.activity_pin_id}>
                        <span class="budget-expense-source">from activity pin</span>
                      </Show>
                      <span class="budget-expense-by">by {expense.created_by}</span>
                    </div>
                    <Show when={expense.notes}>
                      <p class="budget-expense-notes">{expense.notes}</p>
                    </Show>
                  </div>
                  <div class="budget-expense-actions">
                    <button
                      class={`budget-split-badge ${expense.split_type}`}
                      onClick={() => handleToggleSplit(expense)}
                      title={`Click to change to ${expense.split_type === "shared" ? "personal" : "shared"}`}
                    >
                      {expense.split_type === "shared" ? "Shared" : "Personal"}
                    </button>
                    <button
                      class="budget-expense-edit-btn"
                      onClick={() => setEditingExpense(expense)}
                      title="Edit expense"
                    >
                      &#x270E;
                    </button>
                    <button
                      class="budget-expense-delete-btn"
                      onClick={() => handleDelete(expense.id)}
                      title="Delete expense"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

      {/* Add Expense Modal */}
      <Show when={showAddModal()}>
        <AddExpenseModal
          tripId={props.tripId}
          token={props.token}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            refetch();
          }}
        />
      </Show>

      {/* Edit Expense Modal */}
      <Show when={editingExpense()}>
        <EditExpenseModal
          expense={editingExpense()!}
          tripId={props.tripId}
          token={props.token}
          onClose={() => setEditingExpense(null)}
          onUpdated={() => {
            setEditingExpense(null);
            refetch();
          }}
        />
      </Show>
    </div>
  );
}

function AddExpenseModal(props: {
  tripId: string;
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = createSignal("");
  const [amountDollars, setAmountDollars] = createSignal("");
  const [category, setCategory] = createSignal("other");
  const [splitType, setSplitType] = createSignal("shared");
  const [notes, setNotes] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cents = Math.round(parseFloat(amountDollars()) * 100);
    if (!title().trim()) {
      setError("Title is required");
      setLoading(false);
      return;
    }
    if (isNaN(cents) || cents <= 0) {
      setError("Enter a valid amount");
      setLoading(false);
      return;
    }

    try {
      await api.createExpense(props.token, props.tripId, {
        title: title(),
        amount_cents: cents,
        category: category(),
        split_type: splitType(),
        notes: notes() || undefined,
      });
      props.onCreated();
    } catch (err: any) {
      setError(err.message || "Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 class="modal-title">Add Expense</h3>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label class="label-stamp">TITLE</label>
            <input
              type="text"
              class="form-input"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              placeholder="e.g. Flight to Paris"
              autofocus
            />
          </div>
          <div class="form-group">
            <label class="label-stamp">AMOUNT ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              class="form-input"
              value={amountDollars()}
              onInput={(e) => setAmountDollars(e.currentTarget.value)}
              placeholder="0.00"
            />
          </div>
          <div class="form-group">
            <label class="label-stamp">CATEGORY</label>
            <select
              class="form-input"
              value={category()}
              onChange={(e) => setCategory(e.currentTarget.value)}
            >
              <option value="transport">Transport</option>
              <option value="lodging">Lodging</option>
              <option value="restaurant">Restaurant</option>
              <option value="activity">Activity</option>
              <option value="sightseeing">Sightseeing</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label-stamp">SPLIT TYPE</label>
            <div class="split-toggle">
              <button
                type="button"
                class={`split-toggle-btn ${splitType() === "shared" ? "active" : ""}`}
                onClick={() => setSplitType("shared")}
              >
                Shared
              </button>
              <button
                type="button"
                class={`split-toggle-btn ${splitType() === "personal" ? "active" : ""}`}
                onClick={() => setSplitType("personal")}
              >
                Personal
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="label-stamp">NOTES (OPTIONAL)</label>
            <textarea
              class="form-input"
              rows={2}
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
              placeholder="Any additional details..."
            />
          </div>
          <Show when={error()}>
            <p class="form-error">{error()}</p>
          </Show>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onClick={props.onClose}>
              Cancel
            </button>
            <button type="submit" class="btn-primary" disabled={loading()}>
              {loading() ? "Adding..." : "Add Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditExpenseModal(props: {
  expense: Expense;
  tripId: string;
  token: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [title, setTitle] = createSignal(props.expense.title);
  const [amountDollars, setAmountDollars] = createSignal(
    (props.expense.amount_cents / 100).toFixed(2)
  );
  const [category, setCategory] = createSignal(props.expense.category);
  const [splitType, setSplitType] = createSignal(props.expense.split_type);
  const [notes, setNotes] = createSignal(props.expense.notes || "");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cents = Math.round(parseFloat(amountDollars()) * 100);
    if (!title().trim()) {
      setError("Title is required");
      setLoading(false);
      return;
    }
    if (isNaN(cents) || cents <= 0) {
      setError("Enter a valid amount");
      setLoading(false);
      return;
    }

    try {
      await api.updateExpense(props.token, props.tripId, props.expense.id, {
        title: title(),
        amount_cents: cents,
        category: category(),
        split_type: splitType(),
        notes: notes() || undefined,
      });
      props.onUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to update expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 class="modal-title">Edit Expense</h3>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label class="label-stamp">TITLE</label>
            <input
              type="text"
              class="form-input"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
          </div>
          <div class="form-group">
            <label class="label-stamp">AMOUNT ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              class="form-input"
              value={amountDollars()}
              onInput={(e) => setAmountDollars(e.currentTarget.value)}
            />
          </div>
          <div class="form-group">
            <label class="label-stamp">CATEGORY</label>
            <select
              class="form-input"
              value={category()}
              onChange={(e) => setCategory(e.currentTarget.value)}
            >
              <option value="transport">Transport</option>
              <option value="lodging">Lodging</option>
              <option value="restaurant">Restaurant</option>
              <option value="activity">Activity</option>
              <option value="sightseeing">Sightseeing</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label-stamp">SPLIT TYPE</label>
            <div class="split-toggle">
              <button
                type="button"
                class={`split-toggle-btn ${splitType() === "shared" ? "active" : ""}`}
                onClick={() => setSplitType("shared")}
              >
                Shared
              </button>
              <button
                type="button"
                class={`split-toggle-btn ${splitType() === "personal" ? "active" : ""}`}
                onClick={() => setSplitType("personal")}
              >
                Personal
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="label-stamp">NOTES (OPTIONAL)</label>
            <textarea
              class="form-input"
              rows={2}
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
            />
          </div>
          <Show when={error()}>
            <p class="form-error">{error()}</p>
          </Show>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onClick={props.onClose}>
              Cancel
            </button>
            <button type="submit" class="btn-primary" disabled={loading()}>
              {loading() ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
