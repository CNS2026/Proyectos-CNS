(function () {
  "use strict";
  var h = CNSUI.h, $ = function (id) { return document.getElementById(id); };
  $("foot").appendChild(CNSUI.footerNode());

  function note(kind, text) { var m = $("msg"); m.textContent = ""; if (text) m.appendChild(h("div", { class: "note " + kind, text: text })); }
  function getJson(path) {
    return fetch(path + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status); return r.json();
    });
  }

  async function verify(raw) {
    var res = $("result"); res.textContent = "";
    var code = CNS.normalizeCode(raw); $("code").value = code;
    if (!code) { note("warn", "Escribe el código del certificado."); return; }
    if (!CNS.CODE_RE.test(code)) { note("err", "El código no tiene el formato correcto (ejemplo: CNS-2026-AB12-CD34)."); return; }
    $("vbtn").disabled = true; note("info", "Buscando…");
    try {
      var d = await CNS.deriveFromCode(code);
      var all = await Promise.all([getJson("data/registry.json"), getJson("data/revoked.json")]);
      var entry = all[0].filter(function (e) { return e.i === d.id; })[0];
      if (!entry) { note("err", "No encontramos ningún certificado con el código " + code + ". Revisa que esté bien escrito. Si lo acaban de emitir, puede tardar un par de minutos en aparecer."); return; }
      var data = await CNS.openEntry(entry, d);
      data.codigo = code;
      note("", "");
      res.appendChild(CNSUI.certNode(data, { status: all[1].indexOf(d.id) > -1 ? "revocado" : "vigente" }));
      try { history.replaceState(null, "", "?c=" + encodeURIComponent(code)); } catch (e) {}
    } catch (e) {
      note("err", "No se pudo consultar el registro ahora mismo. Inténtalo de nuevo en unos segundos.");
    } finally { $("vbtn").disabled = false; }
  }

  $("vform").addEventListener("submit", function (ev) { ev.preventDefault(); verify($("code").value); });
  var q = new URLSearchParams(location.search).get("c");
  if (q) verify(q);
})();
