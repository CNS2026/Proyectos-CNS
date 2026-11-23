/* Núcleo compartido: códigos, cifrado del registro, utilidades. Funciona en navegador y en Node (pruebas). */
(function (root) {
  "use strict";

  var wc = (typeof crypto !== "undefined" && crypto.subtle) ? crypto : require("node:crypto").webcrypto;
  var subtle = wc.subtle;
  var enc = new TextEncoder(), dec = new TextDecoder();

  var CODE_RE = /^CNS-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  var SALT = "cns-certificados-v1";
  var ITER_CODE = 200000;     // coste de derivar clave a partir del código del certificado
  var ITER_LEDGER = 600000;   // coste de derivar clave a partir de la clave de administración

  function b64(buf) { var b = new Uint8Array(buf), s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(s) { var r = atob(s), b = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return b; }
  function hex(b) { var s = ""; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? "0" : "") + b[i].toString(16); return s; }

  function normalizeCode(s) {
    return String(s || "").toUpperCase().replace(/\s+/g, "").replace(/[–—_]/g, "-");
  }

  function genCode() {
    var al = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", a = wc.getRandomValues(new Uint8Array(8)), s = "";
    for (var i = 0; i < 8; i++) { s += al[a[i] % al.length]; if (i === 3) s += "-"; }
    return "CNS-" + new Date().getFullYear() + "-" + s;
  }

  function maskDoc(tipo, num) {
    var t = String(tipo || "").replace(/\s*\(.*\)/, "").trim();
    var n = String(num || "").replace(/\s+/g, "");
    return n ? t + " ••••" + n.slice(-3) : t;
  }

  // A partir del código se obtiene: un identificador público (para localizar el registro)
  // y una clave AES (para descifrarlo). Sin el código no se puede leer ningún dato.
  async function deriveFromCode(code) {
    var km = await subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
    var bits = new Uint8Array(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(SALT), iterations: ITER_CODE }, km, 512));
    var key = await subtle.importKey("raw", bits.slice(32, 64), "AES-GCM", false, ["encrypt", "decrypt"]);
    return { id: hex(bits.slice(0, 16)), key: key };
  }

  async function sealEntry(code, payload) {
    var d = await deriveFromCode(code);
    var iv = wc.getRandomValues(new Uint8Array(12));
    var ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, d.key, enc.encode(JSON.stringify(payload)));
    return { i: d.id, v: b64(iv), c: b64(ct) };
  }

  async function openEntry(entry, derived) {
    var pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64(entry.v) }, derived.key, unb64(entry.c));
    return JSON.parse(dec.decode(pt));
  }

  // Libro de registro privado (incluye contacto y documento): cifrado con la clave de administración.
  async function ledgerKey(pass, saltB64) {
    var km = await subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: unb64(saltB64), iterations: ITER_LEDGER }, km,
      { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  function newSalt() { return b64(wc.getRandomValues(new Uint8Array(16))); }
  async function ledgerSeal(obj, key, saltB64) {
    var iv = wc.getRandomValues(new Uint8Array(12));
    var ct = await subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(JSON.stringify(obj)));
    return { v: 1, s: saltB64, i: b64(iv), c: b64(ct) };
  }
  async function ledgerOpen(file, key) {
    var pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64(file.i) }, key, unb64(file.c));
    return JSON.parse(dec.decode(pt));
  }

  var api = {
    CODE_RE: CODE_RE, normalizeCode: normalizeCode, genCode: genCode, maskDoc: maskDoc,
    deriveFromCode: deriveFromCode, sealEntry: sealEntry, openEntry: openEntry,
    ledgerKey: ledgerKey, newSalt: newSalt, ledgerSeal: ledgerSeal, ledgerOpen: ledgerOpen, b64: b64, unb64: unb64
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CNS = api;
})(typeof window !== "undefined" ? window : globalThis);
