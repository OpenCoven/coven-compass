/*
 * Coven Atlas — dimensional scene crown.
 * The front uses the shared faceted Psyche symbol. The rear and side contours
 * follow its canonical silhouette. The whole mark stays upright during orbit.
 *
 * The two edge contours below are derived from dist/index.html's #crown path,
 * not a replacement brand asset. Cubic Béziers were adaptively subdivided with
 * a 0.7-source-unit chord tolerance, then normalized by the 1232-unit width.
 * Canonical viewBox: 409 391 1232 1137. Contour 1 is the central aperture.
 * Canonical d SHA-256: 430b74090c1e170575e26aa2c6af49e90d6a9359f1f356a4e76521266322fd32
 * Regenerate the edge samples if the canonical path changes; never replace the
 * exact front face with the samples. The dedicated test guards this provenance.
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var ASPECT = 1137 / 1232;
  var DEPTH = 0.03;
  var FACE_FILL = 'var(--primary, #B3AAEB)';
  var RIM_FILL = 'color-mix(in srgb, ' + FACE_FILL + ' 72%, black)';
  var CONTOURS = [[[-0.000244,-0.460146],[-0.004058,-0.446023],[-0.012084,-0.419389],[-0.021997,-0.390016],[-0.039874,-0.344501],[-0.060308,-0.29789],[-0.080043,-0.257721],[-0.099594,-0.220292],[-0.125548,-0.174067],[-0.151136,-0.131494],[-0.176806,-0.091254],[-0.208685,-0.043831],[-0.230864,-0.012551],[-0.242938,0.002841],[-0.25276,-0.004383],[-0.278744,-0.024168],[-0.307224,-0.043831],[-0.349976,-0.070599],[-0.391427,-0.09306],[-0.433775,-0.112295],[-0.479221,-0.129383],[-0.495617,-0.134334],[-0.497291,-0.133868],[-0.498539,-0.132549],[-0.499452,-0.128213],[-0.499878,-0.119409],[-0.499269,-0.088068],[-0.497502,-0.052108],[-0.494866,-0.018994],[-0.491165,0.013451],[-0.486201,0.047403],[-0.479759,0.083827],[-0.471185,0.122565],[-0.460633,0.162338],[-0.451357,0.19148],[-0.441031,0.220333],[-0.430157,0.247603],[-0.419237,0.271997],[-0.412013,0.287338],[-0.393801,0.321236],[-0.367127,0.365666],[-0.338068,0.407955],[-0.319318,0.432508],[-0.301786,0.45414],[-0.29586,0.461039],[-0.285146,0.460958],[-0.206899,0.460795],[-0.139448,0.460633],[-0.140016,0.456737],[-0.14373,0.440148],[-0.149513,0.421672],[-0.158482,0.400771],[-0.168182,0.383523],[-0.180022,0.368466],[-0.193019,0.355357],[-0.205763,0.346043],[-0.220211,0.338068],[-0.241071,0.330276],[-0.258037,0.324249],[-0.273245,0.316761],[-0.287037,0.30763],[-0.299756,0.296672],[-0.310199,0.286061],[-0.319075,0.2757],[-0.327219,0.264563],[-0.335471,0.251623],[-0.344134,0.236282],[-0.352608,0.219481],[-0.360366,0.202313],[-0.366883,0.185877],[-0.381494,0.141234],[-0.389986,0.106717],[-0.397321,0.070617],[-0.401096,0.046205],[-0.402192,0.033604],[-0.400162,0.032873],[-0.392905,0.03582],[-0.378511,0.043293],[-0.343344,0.063636],[-0.318841,0.08056],[-0.292208,0.10138],[-0.274679,0.116837],[-0.25626,0.134639],[-0.238343,0.153384],[-0.222321,0.171672],[-0.198161,0.20321],[-0.176725,0.236536],[-0.158241,0.271217],[-0.142938,0.306818],[-0.134697,0.330497],[-0.127902,0.354525],[-0.122233,0.380167],[-0.11737,0.408685],[-0.112419,0.453896],[-0.110877,0.460552],[0.0,0.461039],[0.110877,0.460714],[0.111603,0.460023],[0.112185,0.457498],[0.113555,0.442776],[0.117461,0.408421],[0.122646,0.377841],[0.128521,0.353389],[0.134334,0.332711],[0.147595,0.296591],[0.162744,0.263393],[0.182074,0.22874],[0.204099,0.195952],[0.229289,0.164396],[0.258117,0.133442],[0.286932,0.106331],[0.311384,0.08679],[0.335227,0.069562],[0.354359,0.057563],[0.374929,0.045647],[0.392105,0.036517],[0.401055,0.032873],[0.40276,0.032873],[0.402273,0.039935],[0.400374,0.05613],[0.396824,0.076776],[0.386688,0.121591],[0.375984,0.158371],[0.363636,0.192776],[0.35337,0.216637],[0.341772,0.239387],[0.329336,0.260098],[0.316558,0.277841],[0.300294,0.295718],[0.284091,0.309821],[0.27546,0.3153],[0.265513,0.320536],[0.243101,0.329545],[0.224106,0.336558],[0.208695,0.344186],[0.195674,0.353139],[0.183847,0.364123],[0.170882,0.379731],[0.159994,0.397423],[0.151008,0.41752],[0.14375,0.440341],[0.140747,0.45344],[0.139935,0.46039],[0.217675,0.460735],[0.295779,0.459984],[0.302959,0.452148],[0.316629,0.435166],[0.347646,0.393912],[0.364184,0.369257],[0.381575,0.341315],[0.400487,0.307955],[0.415328,0.27889],[0.427719,0.2521],[0.438771,0.225052],[0.449594,0.195211],[0.460319,0.161942],[0.469156,0.128977],[0.481575,0.073498],[0.489367,0.025568],[0.493789,-0.011821],[0.497108,-0.049097],[0.499195,-0.084592],[0.499919,-0.11664],[0.499845,-0.127325],[0.499209,-0.132843],[0.497567,-0.134663],[0.494481,-0.134253],[0.447321,-0.117614],[0.405864,-0.099696],[0.364042,-0.078003],[0.335832,-0.061589],[0.309608,-0.044947],[0.283674,-0.026935],[0.256331,-0.006412],[0.243994,0.002841],[0.217045,-0.034091],[0.204545,-0.051948],[0.162094,-0.115666],[0.138038,-0.154809],[0.114773,-0.194805],[0.088329,-0.243657],[0.064489,-0.29165],[0.043387,-0.338501],[0.025162,-0.383929],[0.01389,-0.416883],[0.004383,-0.448864],[0.000731,-0.460958]],[[0.006737,-0.151786],[0.024371,-0.111891],[0.044075,-0.073214],[0.051136,-0.059984],[0.078653,-0.013799],[0.089205,0.002841],[0.113677,0.039042],[0.142532,0.079383],[0.150974,0.090584],[0.139367,0.103328],[0.117767,0.128072],[0.098062,0.153044],[0.079772,0.178868],[0.062419,0.206169],[0.045099,0.238444],[0.028084,0.274919],[0.018608,0.298711],[0.007305,0.331575],[0.001055,0.350244],[0.000619,0.351035],[0.0,0.350244],[-0.00487,0.335227],[-0.01481,0.305774],[-0.026735,0.275599],[-0.040106,0.245956],[-0.054383,0.218101],[-0.073671,0.186272],[-0.094481,0.155844],[-0.118192,0.125984],[-0.142208,0.09862],[-0.147281,0.092806],[-0.148701,0.090097],[-0.119237,0.049919],[-0.089073,0.005053],[-0.062013,-0.038961],[-0.03818,-0.082143],[-0.018669,-0.121429],[-0.002354,-0.159821],[0.000731,-0.165503]]];

  function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function fmt(value) { return String(Number(value.toFixed(6))); }
  function set(el, key, value) {
    value = String(value);
    if (el.getAttribute(key) !== value) el.setAttribute(key, value);
  }
  function contourArea(points) {
    return points.reduce(function (sum, p, i) {
      var q = points[(i + 1) % points.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2;
  }

  /**
   * create(parent, svgEl?) -> record
   * parent is an SVG group in the same projected coordinate system as x/y.
   * svgEl, if provided, has the site's signature (tag, attributes, parent).
   * The returned .g is decorative; keep the parent's existing hit target and
   * accessible Psyche label. The document must contain the canonical #crown.
   */
  function create(parent, svgEl) {
    if (!parent || !parent.appendChild) throw new TypeError('A crown needs an SVG parent.');
    var make = typeof svgEl === 'function' ? svgEl : function (tag, attrs, target) {
      var node = parent.ownerDocument.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
      if (target) target.appendChild(node);
      return node;
    };
    var g = make('g', {
      'class': 'atlas-crown-3d',
      'aria-hidden': 'true', focusable: 'false', 'pointer-events': 'none',
      'shape-rendering': 'geometricPrecision', filter: 'none'
    }, parent);
    function face(cls, fill, symbol) {
      return make('use', {
        'class': cls, href: symbol,
        x: -0.5, y: -ASPECT / 2, width: 1, height: ASPECT,
        fill: fill, stroke: 'none', filter: 'none'
      }, g);
    }
    var back = face('atlas-crown-back', RIM_FILL, '#crown');
    var sides = make('g', { 'class': 'atlas-crown-sides' }, g);
    var edges = [];
    CONTOURS.forEach(function (points, contour) {
      // Winding alone is insufficient for even-odd paths: the aperture's
      // outward normal points into its opening, independent of path winding.
      var sign = (contourArea(points) > 0 ? 1 : -1) * (contour === 0 ? 1 : -1);
      points.forEach(function (a, index) {
        var b = points[(index + 1) % points.length];
        var dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
        if (length < 0.0000001) return;
        edges.push({
          a: a, b: b, ny: -sign * dx / length, hole: contour !== 0,
          el: make('path', {
            'class': contour === 0 ? 'atlas-crown-wall' : 'atlas-crown-aperture-wall',
            fill: RIM_FILL, stroke: RIM_FILL, 'stroke-linejoin': 'round', display: 'none'
          }, sides)
        });
      });
    });
    var front = face('atlas-crown-front', FACE_FILL, '#psyche-crown');
    var record = { g: g, back: back, sides: sides, front: front, edges: edges, bounds: null };
    draw(record, { x: 0, y: 0, size: 1 });
    return record;
  }

  /**
   * draw(record, { x, y, size }) -> record
   * x/y are the projected center. The crown faces the screen with a shallow
   * vertical rim that scales with its width in both map scopes.
   */
  function draw(record, view) {
    view = view || {};
    var x = finite(view.x, 0), y = finite(view.y, 0);
    var size = clamp(finite(view.size, 1), 0, 1000000);
    set(record.g, 'transform', 'translate(' + fmt(x) + ' ' + fmt(y) + ')');
    set(record.g, 'display', size > 0 ? 'inline' : 'none');
    if (record._geometrySize === size) {
      var cached = record._localBounds;
      record.bounds = { x: x + cached.x, y: y + cached.y, width: cached.width, height: cached.height };
      return record;
    }
    record._geometrySize = size;

    var halfDepth = size * DEPTH / 2;
    var scale = fmt(size);
    var matrix = 'matrix(' + scale + ' 0 0 ' + scale + ' 0 ';
    set(record.back, 'transform', matrix + fmt(halfDepth) + ')');
    set(record.front, 'transform', matrix + fmt(-halfDepth) + ')');

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function project(point, rear) {
      var sx = size * point[0];
      var sy = size * point[1] + (rear ? halfDepth : -halfDepth);
      minX = Math.min(minX, sx); minY = Math.min(minY, sy);
      maxX = Math.max(maxX, sx); maxY = Math.max(maxY, sy);
      return [sx, sy];
    }
    record.edges.forEach(function (edge) {
      var a = project(edge.a, false), b = project(edge.b, false);
      var c = project(edge.b, true), d = project(edge.a, true);
      var shown = edge.ny > 0.000001 && size > 0;
      set(edge.el, 'display', shown ? 'inline' : 'none');
      if (!shown) return;
      set(edge.el, 'd', 'M' + a.map(fmt).join(' ') + ' L' + b.map(fmt).join(' ') +
        ' L' + c.map(fmt).join(' ') + ' L' + d.map(fmt).join(' ') + ' Z');
      // Same-color seam coverage avoids hairline gaps between adjacent walls.
      set(edge.el, 'stroke-width', fmt(Math.min(0.18, size * 0.001)));
    });
    record._localBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    record.bounds = { x: x + minX, y: y + minY, width: maxX - minX, height: maxY - minY };
    return record;
  }

  window.CovenAtlasCrown = Object.freeze({ create: create, draw: draw });
}());
