/* ═══════════════════════════════════════════════════════════
   map-theme.js — generado por SA-Diseñador.
   Colores de Mapbox derivados del tema, para que el mapa deje de
   llevar hexadecimales a mano y siga a la interfaz.

   Cárgalo antes de crear el mapa:
     <script src="js/map-theme.js"></script>

     const T = window.MAP_THEME;
     const map = new mapboxgl.Map({ container: "map", style: T.style });

   Capas de la cartografía (tras el evento load):
     map.getStyle().layers.forEach(l => {
       if (l.type === 'background')            map.setPaintProperty(l.id, 'background-color', T.land);
       else if (/water/.test(l.id))            map.setPaintProperty(l.id, 'fill-color', T.water);
       else if (/road|street/.test(l.id))      map.setPaintProperty(l.id, 'line-color', T.road);
       else if (/building/.test(l.id))         map.setPaintProperty(l.id, 'fill-color', T.building);
       else if (l.type === 'symbol')           map.setPaintProperty(l.id, 'text-color', T.label);
     });

   Marcadores propios:
     'circle-color': T.marker.danger,        // ok · info · warn · danger · neutral
     'circle-stroke-color': T.marker.stroke,

   Magnitudes: T.scale.severity[0..5] (de aviso a crítico)
               T.scale.cool[0..5]     (escala fría, para volumen o velocidad)
   ═══════════════════════════════════════════════════════════ */
window.MAP_THEME = {
  "style": "mapbox://styles/mapbox/light-v11",
  "land": "#e9eaed",
  "water": "#dcdfe3",
  "road": "#c8ccd2",
  "building": "#ced1d7",
  "label": "#465062",
  "marker": {
    "ok": "#485e35",
    "info": "#3b5a78",
    "warn": "#6e5013",
    "danger": "#933c44",
    "neutral": "#465062",
    "stroke": "#e9eaed"
  },
  "popup": {
    "bg": "#f0f0f2",
    "ink": "#191c22",
    "border": "#c8ccd2"
  },
  "control": {
    "bg": "#f0f0f2",
    "ink": "#191c22"
  },
  "scale": {
    "severity": [
      "#3b5a78",
      "#555546",
      "#6e5013",
      "#81462c",
      "#933c44",
      "#682a30"
    ],
    "cool": [
      "#c8ccd2",
      "#8293a5",
      "#3b5a78",
      "#45698d",
      "#4f79a1",
      "#5b86ae"
    ]
  }
};
