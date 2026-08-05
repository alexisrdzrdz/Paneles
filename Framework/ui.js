/* ui.js — generado por SA-Diseñador.
   Pestañas, menús, diálogos, cajón, avisos, tema y tabla, por delegación.
   Sin dependencias: enlázalo con <script defer> y ya está. */
(function () {
  'use strict';

  var doc = document;

  /* ── Utilidades ─────────────────────────────────────────────── */

  function cerca(el, sel) {
    while (el && el.nodeType === 1) {
      if (el.matches && el.matches(sel)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function todos(sel, raiz) {
    return Array.prototype.slice.call((raiz || doc).querySelectorAll(sel));
  }

  /* La raíz con los tokens: dentro del editor es #pagePreview, en una
     página exportada es el <body class="ui">. Se busca hacia arriba desde
     el elemento tocado para que las dos situaciones funcionen igual. */
  function raizUi(desde) {
    return cerca(desde, '.ui') || doc.querySelector('.ui') || doc.body;
  }

  function visible(el) {
    return !!(el && !el.hidden && el.offsetParent !== null);
  }

  /* ── Capas: diálogo, cajón y menú ───────────────────────────── */

  var pilaCapas = [];        // capas abiertas, la última es la de arriba
  var focoPrevio = null;

  var FOCALIZABLE = 'a[href],button:not([disabled]),input:not([disabled])' +
    ',select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function velo(raiz) {
    return raiz.querySelector('[data-ui-veil]');
  }

  function abrirCapa(el, conVelo) {
    if (!el || pilaCapas.indexOf(el) !== -1) return;
    if (!pilaCapas.length) focoPrevio = doc.activeElement;
    el.hidden = false;
    pilaCapas.push(el);
    if (conVelo) {
      var v = velo(raizUi(el));
      if (v) v.hidden = false;
    }
    var primero = el.querySelector(FOCALIZABLE);
    if (primero) primero.focus();
  }

  function cerrarCapa(el) {
    var i = pilaCapas.indexOf(el);
    if (i === -1) return;
    pilaCapas.splice(i, 1);
    el.hidden = true;
    if (!pilaCapas.length) {
      var v = velo(raizUi(el));
      if (v) v.hidden = true;
      /* Devolver el foco donde estaba: sin esto, quien navega con teclado
         acaba al principio del documento cada vez que cierra algo. */
      if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
      focoPrevio = null;
    }
  }

  function cerrarArriba() {
    if (pilaCapas.length) cerrarCapa(pilaCapas[pilaCapas.length - 1]);
    else cerrarMenus();
  }

  function cerrarMenus(salvo) {
    todos('.ui-menu[data-ui-menu]').forEach(function (m) {
      if (m !== salvo) m.hidden = true;
    });
    todos('[data-ui-menu-btn][aria-expanded="true"]').forEach(function (b) {
      if (b.nextElementSibling !== salvo) b.setAttribute('aria-expanded', 'false');
    });
  }

  /* Atrapar el foco dentro de la capa de arriba: un modal del que se
     puede salir con el tabulador no es un modal. */
  function atrapaFoco(e) {
    if (e.key !== 'Tab' || !pilaCapas.length) return;
    var capa = pilaCapas[pilaCapas.length - 1];
    var f = todos(FOCALIZABLE, capa).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var primero = f[0], ultimo = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && doc.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  /* ── Avisos flotantes ───────────────────────────────────────── */

  function aviso(texto, tipo) {
    var caja = doc.querySelector('[data-ui-toasts]');
    if (!caja) return null;
    var t = doc.createElement('div');
    t.className = 'ui-toast' + (tipo ? ' ui-toast-' + tipo : '');
    t.setAttribute('role', 'status');
    /* textContent y no innerHTML: el texto puede venir de la aplicación
       y un aviso no es sitio para ejecutar marcado ajeno. */
    t.textContent = String(texto);
    var x = doc.createElement('button');
    x.type = 'button';
    x.className = 'ui-map-popup-close';
    x.setAttribute('aria-label', 'Cerrar el aviso');
    x.innerHTML = '&times;';
    x.setAttribute('data-ui-toast-close', '');
    t.appendChild(x);
    caja.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 5000);
    return t;
  }

  /* ── Armazón: hamburguesa y menú colapsado ──────────────────── */

  function disposicion(raiz) {
    return raiz.getAttribute('data-layout') || 'topbar';
  }

  /* En hamburguesa el menú empieza cerrado; en los demás armazones el
     menú es parte de la página y no debe ocultarse nunca. Se recalcula
     al cambiar --layout porque el editor lo cambia en vivo. */
  function sincronizaNav(raiz) {
    var nav = raiz.querySelector('.ui-shell-nav');
    if (!nav) return;
    var v = raiz.querySelector('.ui-shell-veil');
    if (disposicion(raiz) === 'hamburger') {
      if (!nav.hasAttribute('data-ui-nav-abierto')) nav.hidden = true;
    } else {
      nav.hidden = false;
      nav.removeAttribute('data-ui-nav-abierto');
    }
    if (v) v.hidden = !nav.hasAttribute('data-ui-nav-abierto');
  }

  function alternaNav(raiz) {
    var nav = raiz.querySelector('.ui-shell-nav');
    if (!nav) return;
    var abierto = nav.hasAttribute('data-ui-nav-abierto');
    if (abierto) nav.removeAttribute('data-ui-nav-abierto');
    else nav.setAttribute('data-ui-nav-abierto', '');
    var b = raiz.querySelector('[data-ui-nav]');
    if (b) b.setAttribute('aria-expanded', String(!abierto));
    sincronizaNav(raiz);
  }

  /* ── Tabla: orden y selección múltiple ──────────────────────── */

  function indiceDe(th) {
    var fila = th.parentElement;
    return Array.prototype.indexOf.call(fila.children, th);
  }

  function ordena(tabla, th) {
    var cuerpo = tabla.tBodies[0];
    if (!cuerpo) return;
    var i = indiceDe(th);
    var desc = th.getAttribute('data-ui-dir') === 'asc';
    var numerica = th.classList.contains('num');
    var filas = Array.prototype.slice.call(cuerpo.rows);

    filas.sort(function (a, b) {
      var ta = (a.cells[i] ? a.cells[i].textContent : '').trim();
      var tb = (b.cells[i] ? b.cells[i].textContent : '').trim();
      var r;
      if (numerica) {
        /* Los importes vienen con separador de miles y coma decimal */
        var na = parseFloat(ta.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
        var nb = parseFloat(tb.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
        r = (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb);
      } else {
        r = ta.localeCompare(tb, 'es', { numeric: true });
      }
      return desc ? -r : r;
    });
    filas.forEach(function (f) { cuerpo.appendChild(f); });

    todos('th', tabla).forEach(function (o) {
      if (o === th) return;
      o.classList.remove('is-sorted');
      o.removeAttribute('data-ui-dir');
      var fl = o.querySelector('.ui-sort');
      if (fl) fl.textContent = '';
    });
    th.classList.add('is-sorted');
    th.setAttribute('data-ui-dir', desc ? 'desc' : 'asc');
    var flecha = th.querySelector('.ui-sort');
    if (!flecha) {
      flecha = doc.createElement('span');
      flecha.className = 'ui-sort';
      th.appendChild(doc.createTextNode(' '));
      th.appendChild(flecha);
    }
    flecha.textContent = desc ? '▼' : '▲';
  }

  function refrescaSeleccion(tabla) {
    var casillas = todos('[data-ui-check]', tabla);
    var n = 0;
    casillas.forEach(function (c) {
      var fila = cerca(c, 'tr');
      if (c.checked) { n++; if (fila) fila.classList.add('is-selected'); }
      else if (fila) fila.classList.remove('is-selected');
    });
    var todas = tabla.querySelector('[data-ui-check-all]');
    if (todas) {
      todas.checked = n > 0 && n === casillas.length;
      todas.indeterminate = n > 0 && n < casillas.length;
    }
    var cuenta = doc.querySelector('[data-ui-count]');
    if (cuenta) {
      var total = cuenta.getAttribute('data-ui-total') || '1.284';
      cuenta.textContent = n + (n === 1 ? ' seleccionado' : ' seleccionados') +
        ' · ' + total + ' registros';
    }
    return n;
  }

  /* ── Tema claro / oscuro ────────────────────────────────────── */

  var LS_TEMA = 'ui-tema';

  function alternaTema() {
    var html = doc.documentElement;
    var actual = html.getAttribute('data-theme');
    /* Sin atributo, el sistema manda: el primer clic tiene que llevar la
       contraria a lo que se está viendo, no a un valor por defecto fijo. */
    if (!actual) {
      var oscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      actual = oscuro ? 'dark' : 'light';
    }
    var nuevo = actual === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', nuevo);
    try { localStorage.setItem(LS_TEMA, nuevo); } catch (e) { /* file:// puede negarlo */ }
    return nuevo;
  }

  function restauraTema() {
    /* Se fija SIEMPRE `data-theme`, haya preferencia guardada o no. Antes solo
       se escribía si localStorage traía algo, y el resto del tiempo la página
       quedaba en `prefers-color-scheme`. Eso funciona, pero deja el estado
       repartido entre dos fuentes: el botón de tema tenía que adivinar contra
       qué estaba alternando, y cualquier regla que dependiera del atributo no
       se aplicaba en la primera visita.

       Al escribirlo en el arranque, el atributo es la única fuente de verdad a
       partir del primer instante. La primera visita sigue respetando la
       preferencia del sistema: es de donde se toma el valor inicial. */
    var elegido = null;
    try { elegido = localStorage.getItem(LS_TEMA); } catch (e) { /* file:// puede negarlo */ }
    if (!elegido) {
      elegido = (window.matchMedia &&
                 window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    doc.documentElement.setAttribute('data-theme', elegido);
  }

  /* ── Un listener por evento, y nada más ─────────────────────── */

  doc.addEventListener('click', function (e) {
    var t = e.target;
    var el;

    /* Cerrar un aviso */
    if (cerca(t, '[data-ui-toast-close]')) {
      var toast = cerca(t, '.ui-toast');
      if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
      return;
    }

    /* Pestañas */
    el = cerca(t, '[data-ui-tab]');
    if (el) {
      e.preventDefault();
      var grupo = cerca(el, '[data-ui-tabs]');
      var destino = el.getAttribute('data-ui-tab');
      if (grupo) {
        todos('[data-ui-tab]', grupo).forEach(function (b) {
          var on = b === el;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', String(on));
        });
      }
      /* Los paneles son hermanos del grupo, no hijos: se buscan en la
         raíz para que den igual el nivel y el orden del marcado. */
      todos('[data-ui-panel]', raizUi(el)).forEach(function (p) {
        if (!grupo || cerca(p, '[data-ui-tabs]')) return;
        p.hidden = p.getAttribute('data-ui-panel') !== destino;
      });
      return;
    }

    /* Control segmentado */
    el = cerca(t, '[data-ui-seg]');
    if (el) {
      var barra = el.parentElement;
      todos('[data-ui-seg]', barra).forEach(function (b) { b.classList.toggle('is-on', b === el); });
      return;
    }

    /* Menú desplegable */
    el = cerca(t, '[data-ui-menu-btn]');
    if (el) {
      e.preventDefault();
      var menu = el.nextElementSibling;
      if (menu && menu.classList.contains('ui-menu')) {
        var abrir = menu.hidden;
        cerrarMenus(abrir ? menu : null);
        menu.hidden = !abrir;
        menu.setAttribute('data-ui-menu', '');
        el.setAttribute('aria-expanded', String(abrir));
      }
      return;
    }

    /* Diálogo modal */
    el = cerca(t, '[data-ui-dialog]');
    if (el) {
      e.preventDefault();
      abrirCapa(doc.getElementById(el.getAttribute('data-ui-dialog')), true);
      return;
    }

    /* Cajón lateral */
    el = cerca(t, '[data-ui-drawer]');
    if (el) {
      e.preventDefault();
      abrirCapa(doc.getElementById(el.getAttribute('data-ui-drawer')), true);
      return;
    }

    /* Cerrar: el velo, la ✕ o cualquier botón marcado */
    el = cerca(t, '[data-ui-close]');
    if (el) {
      e.preventDefault();
      if (el.getAttribute('data-ui-close') === 'nav') {
        var r = raizUi(el);
        var nav = r.querySelector('.ui-shell-nav');
        if (nav) { nav.removeAttribute('data-ui-nav-abierto'); sincronizaNav(r); }
        return;
      }
      var capa = pilaCapas.length ? pilaCapas[pilaCapas.length - 1] : null;
      var propia = cerca(el, '.ui-drawer, .ui-dialog, [role="dialog"]');
      cerrarCapa(propia && pilaCapas.indexOf(propia) !== -1 ? propia :
        (propia && propia.parentElement && pilaCapas.indexOf(propia.parentElement) !== -1
          ? propia.parentElement : capa));
      /* Un popup del mapa no es una capa de la pila: se cierra solo */
      var popup = cerca(el, '.ui-map-popup');
      if (popup) popup.hidden = true;
      return;
    }

    if (cerca(t, '[data-ui-veil]')) { cerrarArriba(); return; }

    /* Hamburguesa y menú colapsado */
    el = cerca(t, '[data-ui-nav]');
    if (el) { e.preventDefault(); alternaNav(raizUi(el)); return; }

    el = cerca(t, '[data-ui-collapse]');
    if (el) {
      e.preventDefault();
      var raizC = raizUi(el);
      raizC.setAttribute('data-layout',
        disposicion(raizC) === 'compact' ? 'sidebar' : 'compact');
      return;
    }

    /* Tema claro / oscuro */
    if (cerca(t, '[data-ui-theme]')) { e.preventDefault(); alternaTema(); return; }

    /* Mostrar la contraseña */
    el = cerca(t, '[data-ui-reveal]');
    if (el) {
      var campo = doc.getElementById(el.getAttribute('data-ui-reveal'));
      if (campo) {
        var oculto = campo.type === 'password';
        campo.type = oculto ? 'text' : 'password';
        el.textContent = oculto ? 'Ocultar' : 'Ver';
        el.setAttribute('aria-label', oculto ? 'Ocultar la contraseña' : 'Mostrar la contraseña');
      }
      return;
    }

    /* Orden de la tabla */
    el = cerca(t, '[data-ui-sort]');
    if (el) {
      var tabla = cerca(el, '[data-ui-table]');
      if (tabla) ordena(tabla, el);
      return;
    }

    /* Navegación lateral: marcar la entrada pulsada */
    el = cerca(t, '.ui-side-item');
    if (el && !el.classList.contains('is-disabled')) {
      e.preventDefault();
      var lado = cerca(el, '.ui-side');
      if (lado) {
        todos('.ui-side-item', lado).forEach(function (a) {
          a.classList.remove('active');
          a.removeAttribute('aria-current');
        });
        el.classList.add('active');
        el.setAttribute('aria-current', 'page');
      }
      var titulo = raizUi(el).querySelector('.ui-shell-title');
      var texto = el.querySelector('.ui-side-text');
      if (titulo && texto) titulo.textContent = texto.textContent;
      /* En hamburguesa, elegir destino cierra el menú */
      if (disposicion(raizUi(el)) === 'hamburger') {
        var nv = raizUi(el).querySelector('.ui-shell-nav');
        if (nv) { nv.removeAttribute('data-ui-nav-abierto'); sincronizaNav(raizUi(el)); }
      }
      return;
    }

    /* Paginación */
    el = cerca(t, '.ui-page');
    if (el && el.textContent.trim().length <= 2 && /\d/.test(el.textContent)) {
      var pager = cerca(el, '.ui-pager');
      if (pager) {
        todos('.ui-page', pager).forEach(function (p) {
          p.classList.remove('is-active');
          p.removeAttribute('aria-current');
        });
        el.classList.add('is-active');
        el.setAttribute('aria-current', 'page');
      }
      return;
    }

    /* Un clic fuera cierra los menús abiertos */
    if (!cerca(t, '.ui-menu')) cerrarMenus();
  });

  doc.addEventListener('change', function (e) {
    var t = e.target;

    if (t.matches && t.matches('[data-ui-check-all]')) {
      var tablaT = cerca(t, '[data-ui-table]');
      if (!tablaT) return;
      todos('[data-ui-check]', tablaT).forEach(function (c) { c.checked = t.checked; });
      refrescaSeleccion(tablaT);
      return;
    }

    if (t.matches && t.matches('[data-ui-check]')) {
      var tablaC = cerca(t, '[data-ui-table]');
      if (tablaC) refrescaSeleccion(tablaC);
    }
  });

  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (pilaCapas.length) { e.preventDefault(); cerrarArriba(); }
      else cerrarMenus();
      return;
    }
    atrapaFoco(e);
  });

  /* Los formularios de demostración no envían nada: avisan y se quedan */
  doc.addEventListener('submit', function (e) {
    if (!cerca(e.target, '[data-ui-form]')) return;
    e.preventDefault();
    aviso('Formulario de ejemplo: no se envía nada.', 'ok');
  });

  /* ── Puesta en marcha ───────────────────────────────────────── */

  function arranca() {
    restauraTema();
    todos('.ui').forEach(function (r) {
      sincronizaNav(r);
      /* El editor cambia --layout en vivo: si no se vuelve a mirar, el
         menú se queda oculto al pasar de hamburguesa a lateral. */
      if (window.MutationObserver) {
        new MutationObserver(function () { sincronizaNav(r); })
          .observe(r, { attributes: true, attributeFilter: ['data-layout'] });
      }
    });
    todos('[data-ui-table]').forEach(refrescaSeleccion);

    /* El reloj sólo si el usuario no ha pedido quietud */
    var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!quieto) {
      setInterval(function () {
        var d = new Date();
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        var h = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
        todos('[data-ui-clock]').forEach(function (c) { c.textContent = h; });
      }, 1000);
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', arranca);
  else arranca();

  /* Lo que se llama desde fuera. Se publica aquí dentro a propósito:
     fuera de la función no se exportaría. */
  window.UI = {
    aviso: aviso,
    dialogo: function (id) { abrirCapa(doc.getElementById(id), true); },
    cerrar: function (el) { if (el) cerrarCapa(el); else cerrarArriba(); },
    tema: alternaTema
  };
})();
