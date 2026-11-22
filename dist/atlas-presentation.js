"use strict";
// @generated from src/atlas-presentation.ts
(function (root) {
    'use strict';
    function detailVisible(previous, pixels, enter, exit) {
        return pixels >= (previous ? exit : enter);
    }
    function primaryRequest(requests, preferred) {
        return requests.find(request => request.id === preferred) ??
            requests.reduce((first, request) => !first || request.t < first.t ? request : first, undefined);
    }
    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
    function overlaps(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }
    function crosses(a, b, box) {
        let first = 0, last = 1;
        for (const [axis, size] of [['x', 'width'], ['y', 'height']]) {
            const delta = b[axis] - a[axis];
            const start = box[axis], end = start + box[size];
            if (!delta) {
                if (a[axis] < start || a[axis] > end)
                    return false;
                continue;
            }
            const p = (start - a[axis]) / delta, q = (end - a[axis]) / delta;
            first = Math.max(first, Math.min(p, q));
            last = Math.min(last, Math.max(p, q));
            if (first > last)
                return false;
        }
        return true;
    }
    function placeAnnotation(anchor, size, frame, occupied, gap = 10, leader = true) {
        const { width, height } = size, { x, y } = anchor;
        if (width > frame.width || height > frame.height)
            return null;
        const positions = [
            [x - width / 2, y + gap], [x - width / 2, y - height - gap],
            [x + gap, y - height / 2], [x - width - gap, y - height / 2],
        ];
        for (const [left, top] of positions) {
            const rect = {
                x: clamp(left, frame.x, frame.x + frame.width - width),
                y: clamp(top, frame.y, frame.y + frame.height - height),
                width, height,
            };
            const end = { x: clamp(x, rect.x, rect.x + width), y: clamp(y, rect.y, rect.y + height) };
            if (end.x === x && end.y === y)
                continue;
            if (occupied.some(box => overlaps(rect, box) || (leader && crosses(anchor, end, box))))
                continue;
            return { ...rect, end };
        }
        return null;
    }
    // All rectangles use viewport pixels, including SVG hit areas and text at the user's font size.
    function placeMissionCaption(rows, anchor, radius, frame, occupied) {
        const clear = (r) => r.x >= frame.x && r.y >= frame.y &&
            r.x + r.width <= frame.x + frame.width && r.y + r.height <= frame.y + frame.height &&
            !occupied.some(box => overlaps(r, box));
        if (rows.every((r, i) => clear(r) && !rows.slice(0, i).some(other => overlaps(r, other))))
            return rows;
        const gap = 3, width = Math.max(...rows.map(r => r.width));
        const height = rows.reduce((total, r) => total + r.height, gap * (rows.length - 1));
        const { x, y } = anchor, reach = radius + 6;
        const above = y - reach - height, below = y + reach, left = x - reach - width, right = x + reach;
        const center = x - width / 2, side = y - rows[0].height / 2;
        for (const [startX, startY] of [[center, below], [center, above], [right, side], [left, side],
            [right, above], [left, above], [right, below], [left, below]]) {
            let top = startY;
            const placed = rows.map(r => {
                const box = { x: startX + (width - r.width) / 2, y: top, width: r.width, height: r.height };
                top += r.height + gap;
                return box;
            });
            if (placed.every(clear))
                return placed;
        }
        // In a narrow gap the title can stay centered while its action moves to another side.
        // At most three rows participate (title, state, tasks). Try aligned positions first.
        const options = rows.map((row, index) => {
            const w = row.width, h = row.height;
            const xs = [x - w / 2, x + reach, x - reach - w];
            const ys = [y + reach, y - reach - h, y - h / 2];
            const candidates = [row];
            for (const [i, j] of [[0, 0], [0, 1], [1, 2], [2, 2], [1, 0], [2, 0], [1, 1], [2, 1]]) {
                candidates.push({ x: xs[i], y: ys[j], width: w, height: h });
            }
            // Look along the seal's axes for the nearest gap between real obstacle edges.
            // This also handles partial clearances that no fixed offset can predict.
            const edges = [];
            const nearby = occupied.filter(b => b.x <= x + reach + w && b.x + b.width >= x - reach - w &&
                b.y <= y + reach + height && b.y + b.height >= y - reach - height);
            const insetX = clamp(row.x, frame.x, frame.x + frame.width - w);
            edges.push({ x: insetX, y: ys[2], width: w, height: h });
            if (index)
                edges.push({ x: insetX, y: row.y, width: w, height: h });
            for (const box of nearby) {
                for (const left of [box.x - w - 1, box.x + box.width + 1]) {
                    edges.push({ x: left, y: ys[2], width: w, height: h });
                    if (index)
                        edges.push({ x: left, y: row.y, width: w, height: h });
                }
                for (const top of [box.y - h - 1, box.y + box.height + 1]) {
                    edges.push({ x: xs[0], y: top, width: w, height: h });
                    edges.push({ x: insetX, y: top, width: w, height: h });
                }
            }
            const distance = (b) => Math.hypot(b.x - row.x, b.y - row.y);
            edges.sort((a, b) => distance(a) - distance(b));
            candidates.push(...edges.filter(b => distance(b) <= reach + Math.max(w, h)));
            const unique = new Map();
            for (const candidate of candidates) {
                const key = Math.round(candidate.x) + ',' + Math.round(candidate.y);
                if (!unique.has(key) && clear(candidate))
                    unique.set(key, candidate);
                if (unique.size === 20)
                    break;
            }
            return [...unique.values()];
        });
        function arrange(placed) {
            if (placed.length === options.length)
                return placed;
            for (const candidate of options[placed.length]) {
                if (placed.some(other => overlaps(candidate, other)))
                    continue;
                const result = arrange([...placed, candidate]);
                if (result)
                    return result;
            }
            return null;
        }
        return arrange([]);
    }
    const api = Object.freeze({ detailVisible, primaryRequest, placeAnnotation, placeMissionCaption });
    if (typeof module === 'object' && module.exports)
        module.exports = api;
    if (root)
        root.CovenAtlasPresentation = api;
}(typeof window === 'object' ? window : null));
