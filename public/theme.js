/* Applies the visitor's theme before first paint.
   Reads the cookies the main RideArrivo site sets on .ridearrivo.com (arrivo_theme_mode, arrivo_theme),
   so the journal opens in the same mode the visitor chose there. Light is the default. */
(function () {
  var root = document.documentElement, mode = 'light';
  function cookie(name) { var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)')); return m ? m[1] : ''; }
  try {
    var v = cookie('arrivo_theme_mode') || cookie('arrivo_theme');
    if (!v) { try { v = localStorage.getItem('arrivo_theme_mode') || ''; } catch (e) {} }
    if (v === 'light' || v === 'dark' || v === 'system') mode = v;
  } catch (e) {}
  var theme = mode === 'system' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-mode', mode);
})();
