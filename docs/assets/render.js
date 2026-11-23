/* Dibujo del certificado, QR y acciones. Todo el texto se inserta con textContent (nunca como HTML). */
(function () {
  "use strict";
  var cfg = window.CNS_CONFIG;

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k]; else if (k === "text") n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00") : new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  }
  function safeLinkedIn(u) { return typeof u === "string" && u.indexOf("https://www.linkedin.com/") === 0 ? u : null; }
  function verifyLink(code) { return cfg.publicUrl + "?c=" + encodeURIComponent(code); }
  function logoSrc(rel) { return rel + "assets/logo.png"; }

  function drawQR(canvas, text) {
    if (typeof qrcode !== "function") return false;
    var qr = qrcode(0, "M"); qr.addData(text); qr.make();
    var n = qr.getModuleCount(), scale = 8, margin = 4, size = (n + margin * 2) * scale;
    canvas.width = size; canvas.height = size;
    var c = canvas.getContext("2d");
    c.fillStyle = "#fff"; c.fillRect(0, 0, size, size); c.fillStyle = "#090a17";
    for (var r = 0; r < n; r++) for (var q = 0; q < n; q++) if (qr.isDark(r, q)) c.fillRect((q + margin) * scale, (r + margin) * scale, scale, scale);
    return true;
  }

  function copyText(text, btn) {
    var old = btn.textContent;
    function ok() { btn.textContent = "¡Copiado!"; setTimeout(function () { btn.textContent = old; }, 1800); }
    function fallback() {
      var t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); ok(); } catch (e) { window.prompt("Copia el texto:", text); }
      document.body.removeChild(t);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  }

  // d: {codigo, nombre, formacionNombre, horas, profesor, profesorLinkedin, fechaFinalizacion, emitidoEn, docMasked}
  // opts: {status: "vigente"|"revocado"|undefined, root: "" | "../"}
  function certNode(d, opts) {
    opts = opts || {}; var root = opts.root || "";
    var link = verifyLink(d.codigo), wrap = h("div");
    var cert = h("div", { class: "cert" });
    cert.appendChild(h("div", { class: "cert-head" }, [h("img", { src: logoSrc(root), alt: "CNS Community Network Service" })]));
    if (opts.status) cert.appendChild(opts.status === "revocado"
      ? h("div", { class: "badge bad", text: "✕ Certificado revocado — ya no es válido" })
      : h("div", { class: "badge ok", text: "✓ Certificado válido" }));
    cert.appendChild(h("div", { class: "cert-title", text: "Certificado de formación" }));
    cert.appendChild(h("p", { class: "lead", text: "Se certifica que" }));
    cert.appendChild(h("h3", { class: "name", text: d.nombre }));
    cert.appendChild(h("p", { class: "lead", text: "completó la formación" }));
    cert.appendChild(h("h4", { class: "course", text: d.formacionNombre }));

    var dl = h("dl", { class: "facts" });
    function fact(k, v) { dl.appendChild(h("dt", { text: k })); var dd = h("dd"); if (typeof v === "string") dd.textContent = v; else dd.appendChild(v); dl.appendChild(dd); }
    fact("Intensidad", d.horas + " horas");
    var li = safeLinkedIn(d.profesorLinkedin);
    if (li) {
      var p = h("span");
      p.appendChild(h("a", { href: li, target: "_blank", rel: "noopener noreferrer", text: d.profesor }));
      p.appendChild(document.createTextNode(" · "));
      p.appendChild(h("a", { href: li, target: "_blank", rel: "noopener noreferrer", text: "Ver perfil en LinkedIn" }));
      fact("Profesor", p);
    } else fact("Profesor", d.profesor);
    fact("Finalización", fmtDate(d.fechaFinalizacion));
    fact("Documento", d.docMasked || "—");
    fact("Emitido el", fmtDate(d.emitidoEn));
    cert.appendChild(dl);

    var canvas = h("canvas", { class: "qr", width: "150", height: "150", "aria-label": "QR de verificación" });
    cert.appendChild(h("div", { class: "cert-foot" }, [
      h("div", { class: "codebox" }, [h("small", { text: "Código de certificado" }), h("div", { class: "code", text: d.codigo })]), canvas]));
    cert.appendChild(h("div", { class: "cert-brand" }, ["Emitido por CNS · ", h("a", { href: cfg.contact.web, target: "_blank", rel: "noopener noreferrer", text: cfg.contact.webTxt })]));
    wrap.appendChild(cert);
    var qrOk = false; try { qrOk = drawQR(canvas, link); } catch (e) {}
    if (!qrOk) canvas.className += " hidden";

    var row = h("div", { class: "actions row" });
    var b1 = h("button", { class: "btn ghost", type: "button", text: "Copiar código" }); b1.onclick = function () { copyText(d.codigo, b1); };
    var b2 = h("button", { class: "btn ghost", type: "button", text: "Copiar enlace de verificación" }); b2.onclick = function () { copyText(link, b2); };
    row.appendChild(b1); row.appendChild(b2);
    if (qrOk) {
      var a = h("a", { class: "btn ghost", href: "#", text: "Descargar QR (PNG)" });
      a.onclick = function () { a.href = canvas.toDataURL("image/png"); a.download = "QR-" + d.codigo + ".png"; };
      row.appendChild(a);
    }
    var pr = h("button", { class: "btn ghost", type: "button", text: "Imprimir / guardar PDF" }); pr.onclick = function () { window.print(); };
    row.appendChild(pr);
    wrap.appendChild(row);
    if (opts.status) {
      var help = h("div", { class: "help" }, ["¿Dudas sobre este certificado? Escríbenos a ",
        h("a", { href: "mailto:" + cfg.contact.email, text: cfg.contact.email }), " o llama al " + cfg.contact.telTxt + "."]);
      wrap.appendChild(help);
    }
    return wrap;
  }

  function footerNode() {
    var c = cfg.contact;
    return h("footer", {}, [
      h("div", { text: "La verificación confirma que el código fue emitido por CNS." }),
      h("div", {}, [h("a", { href: c.web, target: "_blank", rel: "noopener noreferrer", text: c.webTxt }), h("span", { class: "sep", text: "·" }),
        h("a", { href: "mailto:" + c.email, text: c.email }), h("span", { class: "sep", text: "·" }),
        h("a", { href: "tel:" + c.tel, text: c.telTxt })])]);
  }

  window.CNSUI = { h: h, certNode: certNode, footerNode: footerNode, fmtDate: fmtDate, copyText: copyText, verifyLink: verifyLink };
})();
