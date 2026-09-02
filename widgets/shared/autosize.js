/* autosize.js — tell the host page how tall this widget is.
   ---------------------------------------------------------------------------
   The book embeds every widget in <iframe class="widget-frame">, which
   _styles.html gives a hard-coded 440px and then corrects from a
   {type:"widget-height"} postMessage. The shared drawing modules
   (surface3d.js, curve2d.js, ...) each send that message themselves.

   A STANDALONE widget loads no such module, so it never reported, the iframe
   stayed at 440px, and anything taller than that had to be scrolled inside the
   frame -- which defeats the point, since you cannot see the picture and its
   readouts at the same time. Every standalone page should load this file.

   Reports on load, on resize, and whenever the widget's own DOM changes size
   (a slider that widens a badge, a verdict line that wraps to two rows). The
   ResizeObserver is the one that matters in practice: the canvas is resized
   from draw(), long after load, so a single report on load undershoots.
   --------------------------------------------------------------------------- */
(function (global) {
  "use strict";

  var last = 0;

  function report() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    /* getBoundingClientRect beats scrollHeight here: scrollHeight rounds to an
       integer css pixel and, on a fractional-dpr display, can land one pixel
       short and reintroduce a scrollbar. */
    if (!h || Math.abs(h - last) < 2) return;
    last = h;
    if (global.parent && global.parent !== global) {
      global.parent.postMessage({ type: "widget-height", height: h }, "*");
    }
  }

  global.addEventListener("load", report);
  global.addEventListener("resize", report);
  setTimeout(report, 60);
  setTimeout(report, 300);

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(report).observe(document.documentElement);
  }

  global.QVAutosize = { report: report };
})(window);
