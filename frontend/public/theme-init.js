/* Apply before the page paints; no remote requests or inline script required. */
(() => {
  let theme = 'dark';
  try {
    if (localStorage.getItem('brandguard-theme') === 'light') theme = 'light';
  } catch {}
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#f1efe7');
})();
