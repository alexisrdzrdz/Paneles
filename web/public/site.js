/* site.js — menú móvil (hamburguesa) para la barra superior del sitio.
   Construye un botón + .ui-menu a partir de los enlaces de .site-nav.
   ui.js (ya cargado) se encarga de abrir/cerrar por delegación. */
(function () {
  function build() {
    document.querySelectorAll('.ui-topbar').forEach(function (bar) {
      var nav = bar.querySelector('.site-nav');
      var right = bar.querySelector('.ui-topbar-right');
      if (!nav || !right || right.querySelector('.nav-mobile')) return;

      var wrap = document.createElement('div');
      wrap.className = 'nav-mobile';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ui-btn nav-burger';
      btn.setAttribute('data-ui-menu-btn', '');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Abrir menú');
      btn.innerHTML = '\u2630';

      var menu = document.createElement('div');
      menu.className = 'ui-menu';
      menu.hidden = true;

      nav.querySelectorAll('a').forEach(function (a) {
        var it = document.createElement('a');
        it.className = 'ui-menu-item';
        it.href = a.getAttribute('href');
        it.textContent = a.textContent.trim();
        menu.appendChild(it);
      });

      wrap.appendChild(btn);
      wrap.appendChild(menu);
      right.insertBefore(wrap, right.firstChild);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
