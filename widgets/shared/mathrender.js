/* mathrender.js — LaTeX in the widget captions.

   The captions sit inside an RTL page, and plain-text formulas get mangled by
   the bidi algorithm: in "רדיוס מעגל העקמומיות הוא 1/k", the "1" is a European
   Number and the "/" a Common Separator, so the run resolves at RTL level and
   comes out reversed as "k/1". Wrapping each formula in dir="ltr" patches one
   case at a time and still cannot give a real fraction or exponent. KaTeX builds
   its own explicitly-LTR DOM, so it is immune to the surrounding direction.

   KaTeX is fetched from the same CDN the book already uses for MathJax. If it
   cannot be reached, nothing breaks: the widget runs as before and the captions
   fall back to showing their LaTeX source, which is still readable.

   Canvas text is deliberately left alone — it is single letters and axis
   numbers, which bidi handles correctly and which KaTeX could not reach anyway. */
(function (global) {
  "use strict";

  var BASE = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/",
      DELIMS = [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false }   /* not a KaTeX default; we use it */
      ],
      queue = [],
      state = 0;                    /* 0 idle, 1 loading, 2 ready, 3 unavailable */

  function tag(name, props) {
    var n = document.createElement(name), k;
    for (k in props) if (props.hasOwnProperty(k)) n[k] = props[k];
    return n;
  }

  function render(host) {
    if (state !== 2 || !global.renderMathInElement) return;
    try {
      global.renderMathInElement(host, { delimiters: DELIMS, throwOnError: false });
    } catch (e) { /* one bad formula must not take the whole widget down */ }
  }

  function give_up() { state = 3; queue.length = 0; }

  function load() {
    state = 1;
    document.head.appendChild(tag("link", { rel: "stylesheet", href: BASE + "katex.min.css" }));
    var core = tag("script", { src: BASE + "katex.min.js" });
    core.onerror = give_up;
    core.onload = function () {
      var auto = tag("script", { src: BASE + "contrib/auto-render.min.js" });
      auto.onerror = give_up;
      auto.onload = function () {
        state = 2;
        while (queue.length) render(queue.shift());
      };
      document.head.appendChild(auto);
    };
    document.head.appendChild(core);
  }

  /* Call once the widget has written its markup. Safe to call before KaTeX has
     finished loading — the host is queued and typeset when it arrives. */
  function typeset(host) {
    if (!host || state === 3) return;
    if (state === 2) { render(host); return; }
    queue.push(host);
    if (state === 0) load();
  }

  global.MathRender = { typeset: typeset };
})(this);
