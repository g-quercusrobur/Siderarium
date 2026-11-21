/* the website's one script: the live sky in the hero, loaded after the page is up; the still underneath stays if it never arrives */
(function () {
  var f = document.getElementById('live');
  if (!f || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  setTimeout(function () {
    f.addEventListener('load', function () {
      var ok = false; try { ok = !!(f.contentDocument && f.contentDocument.getElementById('dial')); } catch (e) { ok = false; }   // the app answered, not an error page
      if (ok) setTimeout(function () { f.classList.add('live'); }, 1800);
    });
    f.src = f.dataset.src;
  }, 600);
})();
