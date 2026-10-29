/*
 * Pembersih isi artikel (HTML dari editor control panel).
 * Hanya tag & atribut yang ada di daftar yang lolos; sisanya dibuang. Dipakai sebelum
 * isi artikel dimasukkan ke halaman — baik di web maupun di editor control panel.
 */
(function () {
  "use strict";
  // tag asal → tag hasil
  var MAP = {
    P: "p", DIV: "p", H1: "h2", H2: "h2", H3: "h3", H4: "h3", H5: "h3", H6: "h3",
    UL: "ul", OL: "ol", LI: "li", BLOCKQUOTE: "blockquote",
    B: "strong", STRONG: "strong", I: "em", EM: "em", U: "u", BR: "br", A: "a", IMG: "img"
  };
  // dibuang beserta isinya
  var DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, TEMPLATE: 1, NOSCRIPT: 1, SVG: 1, MATH: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, HEAD: 1, TITLE: 1, META: 1, LINK: 1 };

  function clean(html, artikelId) {
    var src = new DOMParser().parseFromString("<body>" + String(html || ""), "text/html").body;
    // dokumen terpisah: gambar belum dimuat selama dibersihkan
    var doc = document.implementation.createHTMLDocument("");
    var out = doc.createElement("div");
    var imgRe = new RegExp("^uploads/artikel/" + String(artikelId || "").replace(/[^a-z0-9-]/g, "") + "/[a-f0-9]{16}\\.jpg$");

    (function walk(from, to) {
      for (var n = from.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { to.appendChild(doc.createTextNode(n.nodeValue)); continue; }
        if (n.nodeType !== 1 || DROP[n.tagName]) continue;
        var tag = MAP[n.tagName];
        if (!tag) { walk(n, to); continue; } // tag lain (span, font, ...) → ambil isinya saja
        var el = doc.createElement(tag);
        if (tag === "a") {
          var href = (n.getAttribute("href") || "").trim();
          if (!/^(https?:\/\/|mailto:)/i.test(href)) { walk(n, to); continue; }
          el.setAttribute("href", href);
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        } else if (tag === "img") {
          var s = (n.getAttribute("src") || "").trim();
          if (!imgRe.test(s)) continue;
          el.setAttribute("src", s);
          el.setAttribute("alt", (n.getAttribute("alt") || "").slice(0, 200));
          el.setAttribute("loading", "lazy");
          el.setAttribute("decoding", "async");
        }
        if (tag !== "br" && tag !== "img") walk(n, el);
        to.appendChild(el);
      }
    })(src, out);

    // buang paragraf kosong berlebih
    Array.prototype.forEach.call(out.querySelectorAll("p, h2, h3, li, blockquote"), function (el) {
      if (!el.textContent.trim() && !el.querySelector("img")) el.remove();
    });
    return out.innerHTML;
  }

  window.VeinmaraRich = { clean: clean };
})();
