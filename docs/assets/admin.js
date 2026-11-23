(function () {
  "use strict";
  var cfg = window.CNS_CONFIG, G = cfg.github, h = CNSUI.h;
  var $ = function (id) { return document.getElementById(id); };
  var REPO = G.api + "/repos/" + G.owner + "/" + G.repo;
  var token = "", ledgerSaltB64 = "", ledgerKey = null, ledger = { entries: [] };
  var enc = new TextEncoder();

  $("foot").appendChild(CNSUI.footerNode());

  /* ---------- mensajes ---------- */
  function msg(el, kind, text) { el.textContent = ""; if (text) el.appendChild(h("div", { class: "note " + kind, text: text })); }

  /* ---------- API de GitHub ---------- */
  function headers(raw, json) {
    var o = { Authorization: "Bearer " + token, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (json) o["Content-Type"] = "application/json";
    return o;
  }
  async function gh(path, method, body) {
    var r = await fetch(REPO + path, { method: method || "GET", cache: "no-store", headers: headers(false, !!body), body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) { var e = new Error("GitHub " + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  async function readFile(rel) {
    var r = await fetch(REPO + "/contents/" + G.dir + "/" + rel + "?ref=" + encodeURIComponent(G.branch) + "&t=" + Date.now(), { cache: "no-store", headers: headers(true) });
    if (r.status === 404) return null;
    if (!r.ok) { var e = new Error("GitHub " + r.status); e.status = r.status; throw e; }
    return r.text();
  }
  // Un solo commit con todos los archivos (registro público, lista de revocados y libro cifrado).
  async function commitFiles(files, message) {
    var ref = await gh("/git/ref/heads/" + G.branch);
    var parent = ref.object.sha;
    var pc = await gh("/git/commits/" + parent);
    var tree = [];
    for (var i = 0; i < files.length; i++) {
      var b = await gh("/git/blobs", "POST", { content: CNS.b64(enc.encode(files[i].content)), encoding: "base64" });
      tree.push({ path: G.dir + "/" + files[i].path, mode: "100644", type: "blob", sha: b.sha });
    }
    var nt = await gh("/git/trees", "POST", { base_tree: pc.tree.sha, tree: tree });
    var nc = await gh("/git/commits", "POST", { message: message, tree: nt.sha, parents: [parent] });
    await gh("/git/refs/heads/" + G.branch, "PATCH", { sha: nc.sha, force: false });
  }

  /* ---------- libro de registro ---------- */
  function sortById(a, b) { return a.i < b.i ? -1 : a.i > b.i ? 1 : 0; }
  async function buildFiles(l) {
    var sealed = await CNS.ledgerSeal(l, ledgerKey, ledgerSaltB64);
    var reg = l.entries.map(function (e) { return e.blob; }).sort(sortById);
    var rev = l.entries.filter(function (e) { return e.estado === "revocado"; }).map(function (e) { return e.blob.i; }).sort();
    return [
      { path: "data/ledger.enc.json", content: JSON.stringify(sealed) },
      { path: "data/registry.json", content: JSON.stringify(reg) },
      { path: "data/revoked.json", content: JSON.stringify(rev) }
    ];
  }
  async function fetchLedger() {
    var txt = await readFile("data/ledger.enc.json");
    if (txt === null) return null;
    var f = JSON.parse(txt);
    return { file: f, data: await CNS.ledgerOpen(f, await CNS.ledgerKey($("pass").value, f.s)) };
  }
  // Aplica un cambio sobre la última versión del libro; si otro administrador publicó a la vez, reintenta.
  async function mutate(fn) {
    for (var attempt = 0; attempt < 3; attempt++) {
      var cur = await fetchLedger();
      var base = cur ? cur.data : { entries: [] };
      var next = await fn(JSON.parse(JSON.stringify(base)));
      try {
        await commitFiles(await buildFiles(next), "Actualización del registro de certificados");
        ledger = next; return;
      } catch (e) { if (e.status === 422 || e.status === 409) continue; throw e; }
    }
    throw new Error("conflicto");
  }

  /* ---------- acceso ---------- */
  var creating = false;
  $("login-form").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var m = $("login-msg"), btn = $("login-btn");
    token = $("tok").value.trim();
    var pass = $("pass").value;
    btn.disabled = true; msg(m, "info", "Comprobando acceso…");
    try {
      var repo;
      try { repo = await gh(""); }
      catch (e) { msg(m, "err", e.status === 401 ? "El token no es válido o caducó." : "No se pudo acceder al repositorio con ese token."); return; }
      if (!repo.permissions || !repo.permissions.push) { msg(m, "err", "El token no tiene permiso de escritura en el repositorio."); return; }

      var txt = await readFile("data/ledger.enc.json");
      if (txt === null) {
        if (!creating) { creating = true; $("confirm-wrap").className = ""; $("pass2").required = true; msg(m, "info", "Primer uso: repite la clave para crear el registro cifrado."); return; }
        if (pass.length < 12) { msg(m, "err", "La clave debe tener al menos 12 caracteres."); return; }
        if (pass !== $("pass2").value) { msg(m, "err", "Las dos claves no coinciden."); return; }
        ledgerSaltB64 = CNS.newSalt();
        ledgerKey = await CNS.ledgerKey(pass, ledgerSaltB64);
        msg(m, "info", "Creando el registro…");
        await mutate(async function (l) { return l; });
      } else {
        var f = JSON.parse(txt); ledgerSaltB64 = f.s;
        ledgerKey = await CNS.ledgerKey(pass, f.s);
        try { ledger = await CNS.ledgerOpen(f, ledgerKey); }
        catch (e) { msg(m, "err", "La clave de cifrado no es correcta."); return; }
      }
      try { if ($("remember").checked) localStorage.setItem("cns_tok", token); else localStorage.removeItem("cns_tok"); } catch (e) {}
      $("login").className = "hidden"; $("panel").className = ""; $("adminbar").className = "adminbar";
      msg(m, "", ""); renderList();
    } catch (e) {
      msg(m, "err", "No se pudo completar el acceso. Revisa tu conexión e inténtalo de nuevo.");
    } finally { btn.disabled = false; }
  });
  try { var saved = localStorage.getItem("cns_tok"); if (saved) { $("tok").value = saved; $("remember").checked = true; } } catch (e) {}

  $("logout").addEventListener("click", function () { token = ""; ledgerKey = null; ledger = { entries: [] }; location.reload(); });

  /* ---------- formulario ---------- */
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function opt(v, t, extra) { var o = h("option", { value: v, text: t }); if (extra) Object.keys(extra).forEach(function (k) { o.setAttribute(k, extra[k]); }); return o; }
  (function fillForm() {
    var d = $("f-tipodoc"), f = $("f-formacion"), p = $("f-profesor");
    d.appendChild(opt("", "Selecciona…")); cfg.docTypes.forEach(function (t) { d.appendChild(opt(t, t)); });
    f.appendChild(opt("", "Selecciona…")); Object.keys(cfg.formaciones).forEach(function (k) { f.appendChild(opt(k, cfg.formaciones[k].nombre, { "data-horas": cfg.formaciones[k].horas })); });
    p.appendChild(opt("", "Selecciona…")); Object.keys(cfg.profesores).forEach(function (k) { p.appendChild(opt(k, cfg.profesores[k].nombre)); });
    $("f-fecha").value = today(); $("f-fecha").max = today();
    f.addEventListener("change", function () {
      var o = f.options[f.selectedIndex], hrs = o && o.getAttribute("data-horas");
      if (hrs) $("f-horas").value = hrs;
      var otro = f.value === "otros"; $("otro-wrap").classList.toggle("hidden", !otro); $("f-otro").required = otro;
    });
  })();

  function validContact(v) {
    if (v.indexOf("@") > -1) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    return /^[+\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 7;
  }

  $("issue-form").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var m = $("issue-msg"), btn = $("issue-btn"); m.textContent = "";
    var contacto = $("f-contacto").value.trim();
    if (!validContact(contacto)) { m.textContent = "Escribe un email o un teléfono válido."; return; }
    var num = $("f-numdoc").value.trim();
    if (num && !/^[\p{L}\p{N}\s.\-]{1,30}$/u.test(num)) { m.textContent = "El número de documento no es válido."; return; }
    var fk = $("f-formacion").value, pk = $("f-profesor").value, tipo = $("f-tipodoc").value;
    var fecha = $("f-fecha").value;
    if (fecha > today()) { m.textContent = "La fecha de finalización no puede ser futura."; return; }
    var nombre = $("f-nombre").value.trim().replace(/\s+/g, " ");
    var prof = cfg.profesores[pk];
    var payload = {
      nombre: nombre, formacion: fk,
      formacionNombre: fk === "otros" ? "Otros procesos digitales: " + $("f-otro").value.trim() : cfg.formaciones[fk].nombre,
      horas: parseInt($("f-horas").value, 10), profesor: prof.nombre, profesorLinkedin: prof.linkedin,
      fechaFinalizacion: fecha, emitidoEn: new Date().toISOString(), docMasked: CNS.maskDoc(tipo, num)
    };
    btn.disabled = true; m.textContent = "Generando y publicando…";
    try {
      var code, entry;
      await mutate(async function (l) {
        var used = {}; l.entries.forEach(function (e) { used[e.code] = 1; });
        do { code = CNS.genCode(); } while (used[code]);
        var blob = await CNS.sealEntry(code, payload);
        entry = { code: code, blob: blob, payload: payload, tipoDoc: tipo, numDoc: num, contacto: contacto, estado: "vigente" };
        l.entries.push(entry); return l;
      });
      m.textContent = "";
      showCert(entry, true);
      $("issue-form").reset(); $("f-fecha").value = today(); $("otro-wrap").classList.add("hidden");
      renderList();
    } catch (e) {
      m.textContent = e.status === 401 || e.status === 403 ? "GitHub rechazó el token (permiso o caducidad)." : "No se pudo publicar el certificado. Inténtalo de nuevo.";
    } finally { btn.disabled = false; }
  });

  /* ---------- certificado, lista, revocación ---------- */
  function dataOf(e) { var d = Object.assign({}, e.payload); d.codigo = e.code; return d; }

  function showCert(e, justIssued) {
    var box = $("cert-view"); box.textContent = "";
    if (justIssued) {
      box.appendChild(h("div", { class: "note ok", text: "Certificado emitido. Entrega al estudiante el código o el QR." }));
      var st = h("div", { class: "note info", text: "Publicando en la página pública… suele tardar 1–2 minutos en poder verificarse." });
      box.appendChild(st); pollPublished(e.blob.i, st);
    }
    box.appendChild(CNSUI.certNode(dataOf(e), { root: "../" }));
    box.appendChild(h("div", { class: "gap-lg" }));
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function pollPublished(id, el) {
    var tries = 0;
    (function tick() {
      fetch("../data/registry.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (reg) {
        if (reg.some(function (x) { return x.i === id; })) { el.className = "note ok"; el.textContent = "✓ Ya se puede verificar en la página pública."; return; }
        if (++tries < 24) setTimeout(tick, 10000); else { el.className = "note warn"; el.textContent = "Todavía no aparece en la página pública. Puede tardar unos minutos más; revisa la pestaña Actions del repositorio si se retrasa."; }
      }).catch(function () { if (++tries < 24) setTimeout(tick, 10000); });
    })();
  }

  function renderList() {
    var body = $("rows"); body.textContent = "";
    var items = ledger.entries.slice().sort(function (a, b) { return a.payload.emitidoEn < b.payload.emitidoEn ? 1 : -1; });
    $("list-title").textContent = "Certificados emitidos (" + items.length + ")";
    if (!items.length) { body.appendChild(h("tr", {}, [h("td", { colspan: "6", text: "Aún no hay certificados emitidos." })])); return; }
    items.forEach(function (e) {
      var rev = e.estado === "revocado";
      var see = h("button", { class: "btn ghost small", type: "button", text: "Ver" }); see.onclick = function () { showCert(e, false); };
      var tog = h("button", { class: "btn ghost small", type: "button", text: rev ? "Reactivar" : "Revocar" });
      tog.onclick = async function () {
        tog.disabled = true;
        try { await mutate(async function (l) { l.entries.forEach(function (x) { if (x.code === e.code) x.estado = rev ? "vigente" : "revocado"; }); return l; }); renderList(); }
        catch (err) { tog.textContent = "Error"; tog.disabled = false; }
      };
      body.appendChild(h("tr", {}, [
        h("td", { text: e.payload.nombre }), h("td", { text: e.payload.formacionNombre }), h("td", { text: e.contacto }),
        h("td", { class: "mono", text: e.code }),
        h("td", {}, [h("span", { class: "pill " + (rev ? "bad" : "ok"), text: rev ? "Revocado" : "Vigente" })]),
        h("td", { class: "row" }, [see, tog])]));
    });
  }
  $("filter").addEventListener("input", function () {
    var q = $("filter").value.toLowerCase();
    document.querySelectorAll("#rows tr").forEach(function (tr) { tr.classList.toggle("hidden", !!q && tr.textContent.toLowerCase().indexOf(q) === -1); });
  });

  $("export").addEventListener("click", function () {
    function esc(v) { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
    var rows = [["codigo", "nombre", "tipo_documento", "numero_documento", "contacto", "formacion", "horas", "profesor", "fecha_finalizacion", "emitido", "estado"]];
    ledger.entries.forEach(function (e) { var p = e.payload; rows.push([e.code, p.nombre, e.tipoDoc, e.numDoc, e.contacto, p.formacionNombre, p.horas, p.profesor, p.fechaFinalizacion, p.emitidoEn, e.estado]); });
    var csv = "﻿" + rows.map(function (r) { return r.map(esc).join(","); }).join("\r\n");
    var a = h("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "certificados-cns.csv" });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });
})();
