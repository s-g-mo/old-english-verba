// Shared page components — edit here to update across all pages.

(function () {
  // ── Footer ──────────────────────────────────────────────────
  const footer = document.querySelector('footer.site-footer');
  if (footer) {
    footer.innerHTML =
      '<span>&copy; 2026 Stephen G. Mosher</span>' +
      '<span>Inspired by the French Bescherelle and the teaching of the Ancient Language Institute.</span>';
  }

  // ── Dynamic verb count (about page Quick Facts) ─────────────
  const verbCountEl = document.getElementById('qf-verb-count');
  if (verbCountEl) {
    fetch('verbs.json')
      .then(r => r.json())
      .then(data => { verbCountEl.textContent = data.length; })
      .catch(() => { /* silently keep the hardcoded fallback */ });
  }
})();
