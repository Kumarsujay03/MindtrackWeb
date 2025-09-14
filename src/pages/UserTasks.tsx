import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/Auth/AuthContext";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, updateDoc, doc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

type UserTask = {
  docId: string; // Firestore document id
  id: string; // user-defined id field in document, fallback to docId
  title: string;
  completed: boolean;
  date?: string; // YYYY-MM-DD
  deadline?: string;
  notification?: boolean;
  reminders?: string[];
  subtasks?: Subtask[]; // assumed shape in Firestore: array of { id, title, completed }
};

export default function UserTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<UserTask[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  function formatNotificationAt(at: string | undefined): string {
    if (!at) return "";
    const [d, tm] = at.split("T");
    if (!d) return "";
    const t = (tm || "").slice(0, 5);
    return t ? `${d} ${t}` : d;
  }

  useEffect(() => {
    if (!user) {
      setTasks(null);
      setLoading(false);
      return;
    }
    const ref = collection(db, "users", user.uid, "tasks");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const rows: UserTask[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const rawSubs = Array.isArray(data?.subtasks) ? data.subtasks : [];
          const normalizedSubs: Subtask[] = rawSubs
            .map((s: any, idx: number) => ({
              id: typeof s?.id === "string" ? s.id : `${d.id}-sub-${idx}`,
              title: typeof s?.title === "string" ? s.title : "(untitled)",
              completed: !!s?.completed,
            }))
            // Avoid pathological objects
            .filter((s: Subtask) => typeof s.title === "string");
          const subtasks = normalizedSubs;
          // normalize reminders: prefer array of strings only
          const normReminders: string[] = Array.isArray(data?.reminders)
            ? (data.reminders as any[]).filter((r) => typeof r === "string")
            : [];
          return {
            docId: d.id,
            id: data?.id ?? d.id,
            title: data?.title ?? "(untitled)",
            completed: !!data?.completed,
            date: data?.date ?? "",
            deadline: data?.deadline ?? "",
            notification: !!data?.notification,
            reminders: normReminders,
            subtasks,
          };
        });
        setTasks(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user]);

  // Toggle: today vs all (sorted by deadline)
  const [view, setView] = useState<"today" | "all">("today");
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const displayTasks = useMemo(() => {
    const list = tasks ?? [];
    if (view === "today") {
      // Show tasks scheduled for today or due today
      return list.filter((t) => (t.date ?? "") === todayStr || (t.deadline ?? "") === todayStr);
    }
    // all: sort by deadline ascending; blanks go to the end. If equal blanks, sort by title
    const sorted = [...list].sort((a, b) => {
      const da = a.deadline || "";
      const dbs = b.deadline || "";
      if (!da && !dbs) return (a.title || "").localeCompare(b.title || "");
      if (!da) return 1;
      if (!dbs) return -1;
      return da.localeCompare(dbs);
    });
    return sorted;
  }, [tasks, view, todayStr]);

  async function toggleComplete(t: UserTask) {
    if (!user) return;
    try {
      // If marking task complete, mark all subtasks complete as well.
      // If unmarking, keep subtasks as-is (user can toggle individually).
      const nextCompleted = !t.completed;
      const patch: any = { completed: nextCompleted };
      if (nextCompleted && Array.isArray(t.subtasks) && t.subtasks.length > 0) {
        patch.subtasks = t.subtasks.map((s) => ({ ...s, completed: true }));
      }
      await updateDoc(doc(db, "users", user.uid, "tasks", t.docId), { ...patch, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error("Failed to toggle task completion", e);
      alert("Couldn't update the task. Please check your connection and try again.");
    }
  }

  async function toggleSubtask(t: UserTask, subIndex: number) {
    if (!user) return;
    const subs = Array.isArray(t.subtasks) ? [...t.subtasks] : [];
    if (subIndex < 0 || subIndex >= subs.length) return;
    subs[subIndex] = { ...subs[subIndex], completed: !subs[subIndex].completed };
    try {
      // If any subtask is unchecked, task cannot be completed.
      // If all subtasks are checked, mark task as completed.
      const allDone = subs.length > 0 && subs.every((s) => !!s.completed);
      await updateDoc(doc(db, "users", user.uid, "tasks", t.docId), { subtasks: subs, completed: allDone, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error("Failed to toggle subtask", e);
      alert("Couldn't update the subtask. Please check your connection and try again.");
    }
  }

  // Delete a task
  async function deleteTask(t: UserTask) {
    if (!user) return;
    const ok = window.confirm(`Delete task "${t.title}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "tasks", t.docId));
    } catch (e) {
      // noop for now
    }
  }

  // Edit modal
  const [editing, setEditing] = useState<UserTask | null>(null);
  const [draft, setDraft] = useState<Partial<UserTask>>({});
  const [draftSubtasks, setDraftSubtasks] = useState<Subtask[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  // Modal reminders state (multiple entries as ISO-like strings YYYY-MM-DDTHH:mm)
  const [remindersState, setRemindersState] = useState<string[]>([]);
  const [newReminderDate, setNewReminderDate] = useState<string>("");
  const [newReminderTime, setNewReminderTime] = useState<string>("");

  function openEdit(t: UserTask) {
    setEditing(t);
    setDraft({ ...t });
    const subs: Subtask[] = Array.isArray(t.subtasks) && t.subtasks.length > 0
      ? t.subtasks.map((s, idx) => ({ id: s.id ?? `${t.docId}-sub-${idx}`, title: s.title, completed: !!s.completed }))
      : [];
    setDraftSubtasks(subs);
    // collect all reminders from task, ensure unique + sorted
    const fromTask = Array.isArray(t.reminders) ? t.reminders.filter((r) => typeof r === "string" && r.includes("T")) : [];
    const uniqueSorted = Array.from(new Set(fromTask)).sort();
    setRemindersState(uniqueSorted);
    setIsCreating(false);
    setNewReminderDate("");
    setNewReminderTime("");
  }

  function closeEdit() {
    setEditing(null);
    setDraft({});
    setDraftSubtasks([]);
    setIsCreating(false);
    setRemindersState([]);
    setNewReminderDate("");
    setNewReminderTime("");
  }

  function openCreate() {
    setIsCreating(true);
    setEditing(null);
  setDraft({ title: "", completed: false, date: "", deadline: "", notification: false, reminders: [] });
    setDraftSubtasks([]);
    setRemindersState([]);
    setNewReminderDate("");
    setNewReminderTime("");
  }

  // Immediate persist helpers when editing existing task
  async function persistSubtasksForEditing(newSubs: Subtask[]) {
    if (!user || !editing) return;
    // Apply completion rules
    const allDone = newSubs.length > 0 && newSubs.every((s) => !!s.completed);
    // If parent is set completed, ensure all subs done
    let completed = draft.completed ?? editing.completed ?? false;
    if (completed) {
      newSubs = newSubs.map((s) => ({ ...s, completed: true }));
    } else {
      completed = allDone;
    }
    try {
      await updateDoc(doc(db, "users", user.uid, "tasks", editing.docId), { subtasks: newSubs, completed, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error("Failed to save subtasks", e);
    }
  }

  async function applyTaskCompletedInModal(nextCompleted: boolean) {
    setDraft((d) => ({ ...d, completed: nextCompleted }));
    if (!user) return;
    if (editing) {
      let subs = [...draftSubtasks];
      if (nextCompleted) {
        subs = subs.map((s) => ({ ...s, completed: true }));
      }
      try {
        await updateDoc(doc(db, "users", user.uid, "tasks", editing.docId), { completed: nextCompleted, subtasks: subs, updatedAt: serverTimestamp() });
      } catch (e) {
        console.error("Failed to set completed in modal", e);
      }
      setDraftSubtasks(subs);
    }
  }

  function addSubtaskInline(title: string) {
    if (!title.trim()) return;
    const newItem: Subtask = { id: `tmp-${Date.now()}`, title: title.trim(), completed: false };
    const newSubs = [...draftSubtasks, newItem];
    setDraftSubtasks(newSubs);
    if (editing && user) {
      // persist immediately
      void persistSubtasksForEditing(newSubs);
    }
  }

  function toggleModalSubtask(idx: number) {
    const subs = [...draftSubtasks];
    if (idx < 0 || idx >= subs.length) return;
    subs[idx] = { ...subs[idx], completed: !subs[idx].completed };
    setDraftSubtasks(subs);
    if (editing && user) {
      void persistSubtasksForEditing(subs);
    }
  }

  function updateModalSubtaskTitle(idx: number, title: string) {
    const subs = [...draftSubtasks];
    if (idx < 0 || idx >= subs.length) return;
    subs[idx] = { ...subs[idx], title };
    setDraftSubtasks(subs);
    if (editing && user) {
      void persistSubtasksForEditing(subs);
    }
  }

  function removeModalSubtask(idx: number) {
    const subs = [...draftSubtasks];
    if (idx < 0 || idx >= subs.length) return;
    subs.splice(idx, 1);
    setDraftSubtasks(subs);
    if (editing && user) {
      void persistSubtasksForEditing(subs);
    }
  }

  async function saveEdit() {
    if (!user || !editing) return;
    // Use draftSubtasks
    const newSubtasks: Subtask[] = draftSubtasks.map((s, idx) => ({ id: s.id ?? `${editing.docId}-sub-${idx}`, title: s.title, completed: !!s.completed }));
    // Completion sync: if task is checked, mark all subtasks done. Else, if subtasks exist, task reflects all-done status.
    let completed = draft.completed ?? editing.completed;
    if (completed && newSubtasks.length > 0) {
      newSubtasks.forEach((s) => (s.completed = true));
    } else if (newSubtasks.length > 0) {
      completed = newSubtasks.every((s) => !!s.completed);
    }
    // compute reminders to save based on modal state
    const notifEnabled = (draft.notification ?? editing.notification) ?? false;
    const finalReminders = notifEnabled ? Array.from(new Set(remindersState.filter(Boolean))).sort() : [];
    const payload: any = {
      title: draft.title ?? editing.title,
      completed,
      date: draft.date ?? editing.date ?? "",
      deadline: draft.deadline ?? editing.deadline ?? "",
      notification: draft.notification ?? editing.notification ?? false,
      reminders: finalReminders,
      subtasks: newSubtasks,
      updatedAt: serverTimestamp(),
    };
    try {
      await updateDoc(doc(db, "users", user.uid, "tasks", editing.docId), payload);
      closeEdit();
    } catch (e) {
      console.error("Failed to save task", e);
      alert("Couldn't save the task. Please try again.");
    }
  }

  async function saveCreate() {
    if (!user || !isCreating) return;
  const newSubtasks: Subtask[] = draftSubtasks.map((s, idx) => ({ id: s.id ?? `new-${Date.now()}-${idx}`, title: s.title, completed: !!s.completed }));
    let completed = !!draft.completed;
    if (completed && newSubtasks.length > 0) {
      newSubtasks.forEach((s) => (s.completed = true));
    } else if (newSubtasks.length > 0) {
      completed = newSubtasks.every((s) => !!s.completed);
    }
    const notifEnabled = !!draft.notification;
    const finalReminders = notifEnabled ? Array.from(new Set(remindersState.filter(Boolean))).sort() : [];
    const payload: any = {
      title: draft.title ?? "(untitled)",
      completed,
      // default date to today so it appears under Today tab
      date: new Date().toISOString().slice(0, 10),
      deadline: draft.deadline ?? "",
      notification: draft.notification ?? false,
      reminders: finalReminders,
      subtasks: newSubtasks,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await addDoc(collection(db, "users", user.uid, "tasks"), payload);
      closeEdit();
    } catch (e) {
      console.error("Failed to create task", e);
      alert("Couldn't create the task. Please try again.");
    }
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-4 mt-6">
      <div className="glass-panel p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Tasks</h2>
          <div className="inline-flex rounded-md border border-white/15 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${view === "today" ? "bg-white/15" : "bg-white/5 hover:bg-white/10"}`}
              onClick={() => setView("today")}
            >
              Today
            </button>
            <button
              className={`px-3 py-1.5 text-sm border-l border-white/10 ${view === "all" ? "bg-white/15" : "bg-white/5 hover:bg-white/10"}`}
              onClick={() => setView("all")}
            >
              All
            </button>
          </div>
        </div>
        {loading ? (
          <p className="text-white/80">Loading…</p>
        ) : !displayTasks || displayTasks.length === 0 ? (
          <p className="text-white/70">No tasks found.</p>
        ) : (
          <ul className="space-y-2 list-none pl-0 m-0">
            {displayTasks.map((t) => (
              <li key={t.docId} className="rounded-md border border-white/15 bg-white/5 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={() => toggleComplete(t)}
                      className="accent-emerald-500 w-4 h-4"
                      title="Mark complete"
                    />
                    <span className="truncate">{t.title}</span>
                  </div>
                  {/* No description fallback; subtasks only */}
                  {Array.isArray(t.subtasks) && t.subtasks.length > 0 && (
                    <div className="mt-2">
                      {t.subtasks.map((s, idx) => (
                        <div key={s.id} className="flex items-center gap-2 text-sm text-white/90 py-0.5">
                          <input
                            type="checkbox"
                            checked={!!s.completed}
                            onChange={() => toggleSubtask(t, idx)}
                            className="accent-emerald-500 w-4 h-4"
                            title="Mark subtask complete"
                          />
                          <span className={"truncate " + (s.completed ? "line-through text-white/60" : "")}>{s.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-white/60 mt-1">
                    {t.date ? `Date: ${t.date}` : ""}
                    {t.deadline ? (t.date ? " · " : "") + `Deadline: ${t.deadline}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3 self-center">
                  <span
                    className="text-xs text-white/60 whitespace-nowrap"
                    title={Array.isArray(t.reminders) && t.reminders.length > 0 ? t.reminders.map((r) => `• ${formatNotificationAt(r)}`).join("\n") : undefined}
                  >
                    {t.notification ? (
                      Array.isArray(t.reminders) && t.reminders.length > 0 ? (
                        (() => {
                          const first = formatNotificationAt(t.reminders[0]);
                          const extra = t.reminders.length - 1;
                          return extra > 0 ? `Notify: ${first} (+${extra} more)` : `Notify: ${first}`;
                        })()
                      ) : (
                        "Notifications on"
                      )
                    ) : (
                      "Notifications off"
                    )}
                  </span>
                  <button
                    className="px-2 py-1 text-xs rounded-md bg-white/10 hover:bg-white/15 border border-white/15"
                    onClick={() => openEdit(t)}
                    title="Edit task"
                  >
                    Edit
                  </button>
                  <button
                    className="px-2 py-1 text-xs rounded-md bg-red-600/20 hover:bg-red-600/30 border border-red-500 text-red-200"
                    onClick={() => deleteTask(t)}
                    title="Delete task"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Floating Add Button */}
      <button
        className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-white text-black text-2xl leading-none flex items-center justify-center shadow-lg hover:bg-white/90 border border-white/20"
        title="Add task"
        aria-label="Add task"
        onClick={openCreate}
      >
        +
      </button>
      {/* Edit/Create Modal */}
      {(editing || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-black/80 backdrop-blur p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{isCreating ? "New Task" : "Edit Task"}</h3>
              <button className="text-white/70 hover:text-white" onClick={closeEdit} aria-label="Close">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/70 mb-1">Title</label>
                <input
                  className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2"
                  value={draft.title ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">Subtasks</label>
                {draftSubtasks.length > 0 && (
                  <div className="mt-1">
                    {draftSubtasks.map((s, idx) => (
                      <div key={s.id} className="flex items-center gap-2 text-sm py-0.5">
                        <input
                          type="checkbox"
                          checked={!!s.completed}
                          onChange={() => toggleModalSubtask(idx)}
                          className="accent-emerald-500 w-4 h-4"
                          title="Mark subtask complete"
                        />
                        <input
                          className={`flex-1 min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm ${s.completed ? "line-through text-white/60" : "text-white/90"}`}
                          value={s.title}
                          onChange={(e) => updateModalSubtaskTitle(idx, e.target.value)}
                          placeholder="Subtask title"
                        />
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 border border-white/15 text-xs"
                          title="Remove subtask"
                          onClick={() => removeModalSubtask(idx)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <AddSubtaskInline onAdd={addSubtaskInline} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/70 mb-1">Deadline (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2"
                    value={draft.deadline ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, deadline: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                {!isCreating && (
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!(draft.completed ?? editing?.completed ?? false)}
                      onChange={(e) => applyTaskCompletedInModal(e.target.checked)}
                    />
                    Completed
                  </label>
                )}
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!(draft.notification ?? editing?.notification ?? false)}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setDraft((d) => ({ ...d, notification: val }));
                      if (!val) {
                        setRemindersState([]);
                      }
                    }}
                  />
                  Notifications
                </label>
              </div>
              {(draft.notification ?? editing?.notification ?? false) && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Reminders</label>
                    {remindersState.length === 0 ? (
                      <div className="text-xs text-white/60">No reminders yet.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {remindersState.map((r, idx) => (
                          <span key={r + idx} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/10 border border-white/15">
                            {formatNotificationAt(r)}
                            <button
                              type="button"
                              className="text-white/60 hover:text-white ml-1"
                              title="Remove reminder"
                              onClick={() => {
                                setRemindersState((arr) => arr.filter((_, i) => i !== idx));
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Date</label>
                      <input
                        type="date"
                        className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2"
                        value={newReminderDate}
                        onChange={(e) => setNewReminderDate(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-white/70 mb-1">Time</label>
                        <input
                          type="time"
                          className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2"
                          value={newReminderTime}
                          onChange={(e) => setNewReminderTime(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="self-end px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/15 text-sm"
                        onClick={() => {
                          if (!newReminderDate || !newReminderTime) return;
                          const iso = `${newReminderDate}T${newReminderTime}`;
                          setRemindersState((arr) => Array.from(new Set([...arr, iso])).sort());
                          setNewReminderDate("");
                          setNewReminderTime("");
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-md border border-white/15 bg-white/5 hover:bg-white/10" onClick={closeEdit}>Cancel</button>
              {isCreating ? (
                <button className="px-3 py-2 rounded-md border border-emerald-500 bg-emerald-600/20 hover:bg-emerald-600/30" onClick={saveCreate}>Create</button>
              ) : (
                <button className="px-3 py-2 rounded-md border border-emerald-500 bg-emerald-600/20 hover:bg-emerald-600/30" onClick={saveEdit}>Save</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline subtask adder component
function AddSubtaskInline({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        className="flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm"
        placeholder="Add subtask and press Enter"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd(value.trim());
            setValue("");
          }
        }}
      />
      <button
        type="button"
        className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/15 text-sm"
        onClick={() => {
          onAdd(value.trim());
          setValue("");
        }}
      >
        Add
      </button>
    </div>
  );
}
