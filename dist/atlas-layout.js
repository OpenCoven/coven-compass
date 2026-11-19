/*
 * Coven Atlas: presentation geometry only; no orchestration or identity state.
 *
 * layout(keys, options) returns one immutable-by-convention scene snapshot.
 * Keys retain caller order. Opposite pairs fill the nearest cells in an
 * aspect-weighted lattice, instead of making one increasingly sparse ring.
 * At unchanged options, appending keys preserves existing node positions.
 * The central cell reserves the hub; other cells reserve the complete Castle
 * AND label rectangle. Empty cells and shared routes imply no task dependency.
 *
 * Routes start exactly on the hub circle and enter the cardinal Castle gate
 * nearest the hub. They follow the empty aisles between rows/columns. Their
 * final approach may enter their own reserved rectangle, never another one.
 * Rendering may round corners by at most maxCornerRadius without exhausting
 * the reserved aisle clearance. The default four-corner fort gates are ±280.
 * If smaller footprints are requested, the default gate offset is reduced to
 * fit; an explicit offset outside the footprint is rejected.
 *
 * Bounds include every reserved rectangle, the hub, routes, and padding.
 * Screen-pixel label measurement and header/inspector/chip safe insets belong
 * to the camera-fit layer, not this world-coordinate module. Cache using the
 * ordered keys and normalized geometric options, not mission count/state.
 *
 * Options: aspect=1.6 (clamped to 1/8..8), nodeWidth=800, nodeHeight=900,
 * gap=220, hubRadius=520, gateOffset=min(280, width/2, height/2), padding=gap/2.
 * This is a bounded-detail layout helper, not a browser performance guarantee.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CovenAtlasLayout = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function numeric(options, name, fallback, allowZero) {
    const value = options[name] === undefined ? fallback : options[name];
    if (typeof value !== 'number' || !Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
      throw new RangeError(name + ' must be a finite ' + (allowZero ? 'non-negative' : 'positive') + ' number');
    }
    return value;
  }

  function normalized(options) {
    if (options === undefined) options = {};
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object');
    const nodeWidth = numeric(options, 'nodeWidth', 800);
    const nodeHeight = numeric(options, 'nodeHeight', 900);
    const gap = numeric(options, 'gap', 220, true);
    const gateOffset = numeric(options, 'gateOffset', Math.min(280, nodeWidth / 2, nodeHeight / 2), true);
    if (gateOffset > Math.min(nodeWidth, nodeHeight) / 2) throw new RangeError('gateOffset must fit inside the reserved node rectangle');
    return {
      aspect: Math.max(1 / 8, Math.min(8, numeric(options, 'aspect', 1.6))),
      nodeWidth,
      nodeHeight,
      gap,
      hubRadius: numeric(options, 'hubRadius', 520, true),
      gateOffset,
      padding: numeric(options, 'padding', gap / 2, true)
    };
  }

  function coordinate(cell, first, step) {
    return cell === 0 ? 0 : Math.sign(cell) * (first + (Math.abs(cell) - 1) * step);
  }

  // Enumerate only half the lattice: each entry represents one opposite pair.
  // Expanding a distance threshold includes every nearer cell, so the selected
  // prefix is independent of how many later keys the caller adds.
  function pairedCells(count, config, centralX, centralY) {
    if (!count) return [];
    const needed = Math.ceil(count / 2);
    const stepX = config.nodeWidth + config.gap;
    const stepY = config.nodeHeight + config.gap;
    const firstX = centralX + config.gap + config.nodeWidth / 2;
    const firstY = centralY + config.gap + config.nodeHeight / 2;
    const stretch = Math.sqrt(config.aspect);
    let radius = Math.max(
      Math.min(firstX / stretch, firstY * stretch),
      Math.sqrt((count + 1) * stepX * stepY / Math.PI)
    );
    let candidates;
    do {
      if (!Number.isFinite(radius)) throw new RangeError('layout geometry exceeds finite coordinate range');
      candidates = [];
      const columns = Math.min(needed, Math.max(0, Math.floor((radius * stretch - firstX) / stepX) + 1));
      const rows = Math.min(needed, Math.max(0, Math.floor((radius / stretch - firstY) / stepY) + 1));
      for (let row = 0; row <= rows; row++) {
        for (let column = row === 0 ? 1 : -columns; column <= columns; column++) {
          const x = coordinate(column, firstX, stepX);
          const y = coordinate(row, firstY, stepY);
          const distance = Math.hypot(x / stretch, y * stretch);
          if (distance > radius * (1 + 1e-12)) continue;
          // The first cell of a pair is in the upper half-plane, or due east.
          const firstColumn = row ? -column : column;
          const firstRow = row ? -row : 0;
          const angle = (Math.atan2(firstRow, firstColumn) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
          candidates.push({ column: firstColumn || 0, row: firstRow || 0, distance, angle });
        }
      }
      if (candidates.length < needed) radius *= 1.5;
    } while (candidates.length < needed);
    candidates.sort((a, b) => a.distance - b.distance || a.angle - b.angle || a.row - b.row || a.column - b.column);
    const cells = [];
    for (let i = 0; cells.length < count; i++) {
      const a = candidates[i];
      cells.push({ column: a.column, row: a.row });
      if (cells.length < count) cells.push({ column: -a.column || 0, row: -a.row || 0 });
    }
    return cells.map(cell => ({
      column: cell.column,
      row: cell.row,
      x: coordinate(cell.column, firstX, stepX),
      y: coordinate(cell.row, firstY, stepY)
    }));
  }

  function simplify(points) {
    const result = [];
    for (const point of points) {
      const b = result[result.length - 1];
      if (b && b[0] === point[0] && b[1] === point[1]) continue;
      if (result.length > 1) {
        const a = result[result.length - 2];
        const vertical = a[0] === b[0] && b[0] === point[0];
        const horizontal = a[1] === b[1] && b[1] === point[1];
        const forward = (b[0] - a[0]) * (point[0] - b[0]) + (b[1] - a[1]) * (point[1] - b[1]) >= 0;
        if ((vertical || horizontal) && forward) result.pop();
      }
      result.push(point);
    }
    return result;
  }

  function routeTo(node, config, centralX, centralY) {
    const innerX = centralX + config.gap / 2;
    const innerY = centralY + config.gap / 2;
    let points;
    let gate;
    if (Math.abs(node.x) >= Math.abs(node.y)) {
      const direction = Math.sign(node.x);
      const aisleX = node.x - direction * (config.nodeWidth / 2 + config.gap / 2);
      const trunkY = (Math.sign(node.y) || -1) * innerY;
      gate = { side: direction > 0 ? 'W' : 'E', x: node.x - direction * config.gateOffset, y: node.y, dx: -direction * config.gateOffset, dy: 0 };
      points = Math.abs(node.column) === 1
        ? [[direction * config.hubRadius, 0], [aisleX, 0], [aisleX, node.y], [gate.x, gate.y]]
        : [[direction * config.hubRadius, 0], [direction * innerX, 0], [direction * innerX, trunkY], [aisleX, trunkY], [aisleX, node.y], [gate.x, gate.y]];
    } else {
      const direction = Math.sign(node.y);
      const aisleY = node.y - direction * (config.nodeHeight / 2 + config.gap / 2);
      const trunkX = (Math.sign(node.x) || 1) * innerX;
      gate = { side: direction > 0 ? 'N' : 'S', x: node.x, y: node.y - direction * config.gateOffset, dx: 0, dy: -direction * config.gateOffset };
      points = Math.abs(node.row) === 1
        ? [[0, direction * config.hubRadius], [0, aisleY], [node.x, aisleY], [gate.x, gate.y]]
        : [[0, direction * config.hubRadius], [0, direction * innerY], [trunkX, direction * innerY], [trunkX, aisleY], [node.x, aisleY], [gate.x, gate.y]];
    }
    return { key: node.key, points: simplify(points), gate };
  }

  function layout(keys, options) {
    if (!Array.isArray(keys)) throw new TypeError('keys must be an array');
    const seen = new Set();
    for (const key of keys) {
      if (typeof key !== 'string' && !(typeof key === 'number' && Number.isFinite(key))) throw new TypeError('keys must be strings or finite numbers');
      if (seen.has(key)) throw new RangeError('keys must be unique');
      seen.add(key);
    }
    const config = normalized(options);
    const centralX = Math.max(config.hubRadius, config.nodeWidth / 2);
    const centralY = Math.max(config.hubRadius, config.nodeHeight / 2);
    const cells = pairedCells(keys.length, config, centralX, centralY);
    const nodes = cells.map((cell, i) => Object.assign({ key: keys[i], width: config.nodeWidth, height: config.nodeHeight }, cell));
    const routes = nodes.map(node => {
      const route = routeTo(node, config, centralX, centralY);
      node.gate = Object.assign({}, route.gate);
      return route;
    });
    const bounds = { x0: -config.hubRadius, y0: -config.hubRadius, x1: config.hubRadius, y1: config.hubRadius };
    function include(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('layout geometry exceeds finite coordinate range');
      bounds.x0 = Math.min(bounds.x0, x);
      bounds.y0 = Math.min(bounds.y0, y);
      bounds.x1 = Math.max(bounds.x1, x);
      bounds.y1 = Math.max(bounds.y1, y);
    }
    for (const node of nodes) {
      include(node.x - node.width / 2, node.y - node.height / 2);
      include(node.x + node.width / 2, node.y + node.height / 2);
    }
    for (const route of routes) for (const point of route.points) include(point[0], point[1]);
    bounds.x0 -= config.padding;
    bounds.y0 -= config.padding;
    bounds.x1 += config.padding;
    bounds.y1 += config.padding;
    if (!Object.values(bounds).every(Number.isFinite)) throw new RangeError('padded bounds exceed finite coordinate range');
    return {
      nodes,
      routes,
      bounds,
      hub: { x: 0, y: 0, radius: config.hubRadius },
      config,
      maxCornerRadius: config.gap / 4
    };
  }

  /*
   * Overview-only mission packing. Caller order chooses the first visible
   * missions; this helper never changes counts, priority, progress, or state.
   * There are at most eight seal slots and one explicit overflow marker.
   * radius bounds the centers, not the complete discs. Use sealRadius for the
   * rendered seal and scale any decorative court accordingly. Dense 3×3 slots
   * recommend a smaller radius to keep an actual gap between their discs.
   */
  function missionPacking(count, options) {
    if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('count must be a non-negative safe integer');
    if (options === undefined) options = {};
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object');
    const requestedLimit = options.limit === undefined ? 8 : options.limit;
    if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 0) throw new RangeError('limit must be a non-negative safe integer');
    const limit = Math.min(8, requestedLimit);
    const radius = numeric(options, 'radius', 150);
    const preferredRadius = numeric(options, 'sealRadius', 52);
    const visible = Math.min(count, limit);
    const hidden = count - visible;
    const slots = visible + (hidden ? 1 : 0);
    const columns = Math.ceil(Math.sqrt(slots));
    const rows = columns ? Math.ceil(slots / columns) : 0;
    const spread = Math.hypot((columns - 1) / 2, (rows - 1) / 2);
    const spacing = slots > 1 ? radius / spread : 0;
    const sealRadius = slots > 1 ? Math.min(preferredRadius, spacing * 0.4) : preferredRadius;
    const positions = [];
    for (let index = 0; index < slots; index++) {
      const row = Math.floor(index / columns);
      const countInRow = Math.min(columns, slots - row * columns);
      positions.push({
        x: (index % columns - (countInRow - 1) / 2) * spacing || 0,
        y: (row - (rows - 1) / 2) * spacing || 0
      });
    }
    return {
      total: count,
      visible,
      hidden,
      items: positions.slice(0, visible).map((position, index) => Object.assign({ index }, position)),
      more: hidden ? Object.assign({ count: hidden }, positions[visible]) : null,
      sealRadius,
      spacing
    };
  }

  return Object.freeze({ layout, missionPacking });
});
