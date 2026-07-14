// js/crypto.js
const ITERATIONS = 100000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

let derivedKey = null;

// --- Base64 helpers ---
function b64ToBuf(s) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
}
function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// --- Derive key from password ---
async function deriveKeyFromPassword(pwd, saltBuf) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(pwd), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBuf, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// --- Encrypt/Decrypt with current derivedKey ---
async function encryptWithKey(plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, derivedKey, enc.encode(plaintext));
  const packaged = new Uint8Array(iv.byteLength + ct.byteLength);
  packaged.set(iv, 0);
  packaged.set(new Uint8Array(ct), iv.byteLength);
  return bufToB64(packaged.buffer);
}

async function decryptWithKey(b64pack) {
  const pack = new Uint8Array(b64ToBuf(b64pack));
  const iv = pack.slice(0, IV_BYTES);
  const ct = pack.slice(IV_BYTES);
  try {
    const ptbuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, derivedKey, ct);
    return new TextDecoder().decode(ptbuf);
  } catch (e) {
    throw new Error("Decryption failed");
  }
}
