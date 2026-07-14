// js/storage.js
function getSalt() {
  return localStorage.getItem("sn_salt") ? b64ToBuf(localStorage.getItem("sn_salt")) : null;
}
function saveSalt(buf) {
  localStorage.setItem("sn_salt", bufToB64(buf));
}

function saveNotesToStorage(notes) {
  localStorage.setItem("sn_notes", JSON.stringify(notes));
}
function loadNotesFromStorage() {
  return JSON.parse(localStorage.getItem("sn_notes") || "{}");
}

function wipeAllData() {
  localStorage.removeItem("sn_salt");
  localStorage.removeItem("sn_notes");
  localStorage.removeItem("sn_test");
}
