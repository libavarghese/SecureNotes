// js/notes.js
let notes = {};
let AUTOLOCK_MS = 120000; // default 2 mins
let autoLockTimer = null;

const el = id => document.getElementById(id);

// Escape HTML safely
function escapeHtml(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function resetEditor() {
  el("noteTitle").value = "";
  el("noteContent").value = "";
  if (el("saveNoteBtn")) delete el("saveNoteBtn").dataset.edit;
}

// Auto-lock
function resetAutoLockTimer() {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  if (derivedKey && AUTOLOCK_MS > 0) {
    autoLockTimer = setTimeout(() => {
      derivedKey = null;
      alert("App auto-locked due to inactivity.");
      window.location.href = "index.html";
    }, AUTOLOCK_MS);
  }
}

// Refresh notes list
async function refreshNotesList(filter) {
  el("notesList").innerHTML = "";
  const keys = Object.keys(notes).sort((a, b) => b.localeCompare(a));
  let shown = 0, failed = 0;

  for (const id of keys) {
    try {
      const title = await decryptWithKey(notes[id].title);
      if (filter && !title.toLowerCase().includes(filter.toLowerCase())) continue;
      shown++;

      const updated = notes[id].updatedAt ? new Date(notes[id].updatedAt).toLocaleString() : "";

      const div = document.createElement("div");
      div.className = "note";
      div.innerHTML = `
        <div class="note-title">${escapeHtml(title)}</div>
        <div class="small">id: ${id}${updated ? " • updated: " + updated : ""}</div>
        <div style="margin-top:8px" class="actions">
          <button class="btn" onclick="openNote('${id}')">Open</button>
          <button class="btn secondary" onclick="deleteNote('${id}')">Delete</button>
        </div>`;
      el("notesList").appendChild(div);

    } catch (e) {
      failed++;
      const div = document.createElement("div");
      div.className = "note";
      div.innerHTML = `
        <div class="note-title">🔒 Encrypted note (wrong password)</div>
        <div class="small">id: ${id}</div>
        <div style="margin-top:8px" class="actions">
          <button class="btn secondary" onclick="deleteNote('${id}')">Delete</button>
        </div>`;
      el("notesList").appendChild(div);
    }
  }

  el("noteCount").textContent =
    failed > 0 && shown === 0
      ? `${failed} encrypted note${failed > 1 ? "s" : ""} (wrong password)`
      : shown
        ? `${shown} note${shown > 1 ? "s" : ""}`
        : "no notes";
}

async function openNote(id) {
  const title = await decryptWithKey(notes[id].title);
  const content = await decryptWithKey(notes[id].data);
  el("noteTitle").value = title;
  el("noteContent").value = content;
  el("saveNoteBtn").dataset.edit = id;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteNote(id) {
  if (!confirm("Delete this note?")) return;
  delete notes[id];
  saveNotesToStorage(notes);
  refreshNotesList(el("searchBox").value);
}

// Event handlers
el("saveNoteBtn").onclick = async () => {
  const title = el("noteTitle").value.trim();
  const body = el("noteContent").value;
  if (!title) {
    alert("Title required");
    return;
  }
  if (!derivedKey) {
    alert("Unlock first");
    return;
  }

  const idEdit = el("saveNoteBtn").dataset.edit;
  const targetId = idEdit || `note-${Date.now()}`;
  const encTitle = await encryptWithKey(title);
  const encBody = await encryptWithKey(body);

  notes[targetId] = { title: encTitle, data: encBody, updatedAt: Date.now() };
  saveNotesToStorage(notes);
  resetEditor();
  refreshNotesList(el("searchBox").value);
};

el("lockBtn").onclick = () => {
  derivedKey = null;
  window.location.href = "index.html";
};

el("searchBox").oninput = () => refreshNotesList(el("searchBox").value);

el("exportBtn").onclick = () => {
  (async () => {
    const title = el("noteTitle").value.trim();
    const content = el("noteContent").value;

    if (!title || !content) {
      alert("No note to export!");
      return;
    }

    if (!derivedKey) {
      alert("Unlock first to export.");
      return;
    }

    // Encrypt only the note currently in the editor
    const encTitle = await encryptWithKey(title);
    const encContent = await encryptWithKey(content);

    const noteId = `note-${Date.now()}`;
    const data = {
      metadata: {
        salt: localStorage.getItem("sn_salt") || null,
        exportedAt: new Date().toISOString()
      },
      notes: {
        [noteId]: {
          title: encTitle,
          data: encContent,
          updatedAt: Date.now()
        }
      }
    };

    // Yield to main thread to avoid UI freeze on mobile
    setTimeout(() => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secure-note-${Date.now()}.json`;
      a.click();
    }, 0);
  })();
};

el("importBtn").onclick = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";

  input.onchange = e => {
    const f = e.target.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);

        if (!parsed.notes) throw new Error("No notes found in file");

        // Only import the first note in the file (current-note export guarantees one)
        const firstNoteId = Object.keys(parsed.notes)[0];
        const firstNote = parsed.notes[firstNoteId];

        if (!firstNote || !firstNote.title || !firstNote.data) throw new Error("Invalid note structure");

        // Merge safely into existing notes
        notes[firstNoteId] = firstNote;
        saveNotesToStorage(notes);

        alert("Imported encrypted note. Unlock with your password.");
      } catch (err) {
        console.error(err);
        alert("Invalid or corrupted file");
      }
    };

    reader.readAsText(f);
  };

  input.click();
};

el("autoLockSelect").onchange = () => {
  AUTOLOCK_MS = parseInt(el("autoLockSelect").value, 10);
  localStorage.setItem("sn_autolock", AUTOLOCK_MS);
  resetAutoLockTimer();
};

// --- Secure Init ---
(async function initNotes() {
  const pwd = prompt("Enter your master password to unlock notes:");
  if (!pwd) {
    alert("Password required");
    window.location.href = "index.html";
    return;
  }

  const salt = getSalt();
  if (!salt) {
    alert("No password found, please set one first.");
    window.location.href = "index.html";
    return;
  }

  try {
    derivedKey = await deriveKeyFromPassword(pwd, salt);

    const testCipher = localStorage.getItem("sn_test");
    if (!testCipher) throw new Error("Missing test marker");
    await decryptWithKey(testCipher);
  } catch {
    alert("Wrong password");
    window.location.href = "index.html";
    return;
  }

  notes = loadNotesFromStorage();

  const savedLockMs = localStorage.getItem("sn_autolock");
  if (savedLockMs !== null) {
    AUTOLOCK_MS = parseInt(savedLockMs, 10);
    el("autoLockSelect").value = AUTOLOCK_MS;
  }

  refreshNotesList("");
  ["click", "keydown", "mousemove", "touchstart", "visibilitychange"].forEach(evt => {
    document.addEventListener(evt, () => {
      if (evt === "visibilitychange") {
        if (!document.hidden) resetAutoLockTimer();
      } else resetAutoLockTimer();
    }, { passive: true });
  });
  resetAutoLockTimer();
})();
