// js/login.js
const el = id => document.getElementById(id);

// --- Create new password ---
el("createBtn").onclick = async () => {
  const p1 = el("newPwd").value;
  const p2 = el("newPwd2").value;
  if (!p1 || p1 !== p2) {
    alert("Passwords must match and not be empty");
    return;
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  saveSalt(salt.buffer);

  derivedKey = await deriveKeyFromPassword(p1, salt.buffer);

  const testCipher = await encryptWithKey("SecureNotesTest");
  localStorage.setItem("sn_test", testCipher);

  alert("Master password set. Keep it safe — no recovery.");
  el("newPwd").value = "";
  el("newPwd2").value = "";

  window.location.href = "notes.html";
};

// --- Proceed button ---
el("proceedBtn")?.addEventListener("click", () => {
  window.location.href = "notes.html";
});

// --- Secure Factory reset ---
el("wipeBtn")?.addEventListener("click", async () => {
  const pwd = prompt("Enter your master password to confirm reset:");
  if (!pwd) return;

  const salt = getSalt();
  if (!salt) {
    alert("No password is set, nothing to reset.");
    return;
  }

  try {
    // Verify password with stored test cipher
    derivedKey = await deriveKeyFromPassword(pwd, salt);
    const testCipher = localStorage.getItem("sn_test");
    await decryptWithKey(testCipher);

    if (!confirm("Are you sure? All notes will be permanently erased.")) return;
    wipeAllData();
    alert("Data wiped. Please create a new master password.");
    location.reload();
  } catch {
    alert("Incorrect password — cannot reset.");
  }
});

// --- Init ---
(function initLogin() {
  if (getSalt()) {
    // Returning user
    el("firstUse").classList.add("hidden");
    el("returningUser").classList.remove("hidden");
    el("lockStatus").textContent = "🗝️ Returning User";  // ✅ show key icon
  } else {
    // First-time setup
    el("firstUse").classList.remove("hidden");
    el("returningUser").classList.add("hidden");
    el("lockStatus").textContent = "🔒 Setup";
  }
})();
