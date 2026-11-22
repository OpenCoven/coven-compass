"use strict";
// @generated from src/atlas-viewport.ts
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports)
        module.exports = api;
    if (root)
        root.CovenAtlasViewport = api;
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';
    const LIMIT = Number.MAX_SAFE_INTEGER;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    const scalar = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? clamp(value, -LIMIT, LIMIT) : fallback;
    const object = (value) => value && typeof value === 'object' ? value : {};
    const dimension = (value) => Math.max(1, scalar(value, 1));
    const positive = (value, fallback) => Math.max(0, scalar(value, fallback));
    function axis(length, before, after) {
        const total = before + after;
        if (total > length - 1) {
            const factor = (length - 1) / total;
            before *= factor;
            after *= factor;
        }
        return { start: before, length: Math.max(1, length - before - after) };
    }
    function frame(x, y, width, height) {
        return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
    }
    function safeFrame(input) {
        const options = object(input);
        const width = dimension(options.width), height = dimension(options.height);
        const padding = positive(options.padding, 24);
        const inset = { top: padding, right: padding, bottom: padding, left: padding };
        const occluders = Array.isArray(options.occluders) ? options.occluders : [];
        for (const value of occluders) {
            const o = object(value);
            if (!Object.prototype.hasOwnProperty.call(inset, o.edge) || ![o.x, o.y, o.width, o.height].every(Number.isFinite) || o.width <= 0 || o.height <= 0)
                continue;
            const x0 = clamp(scalar(o.x, 0), 0, width);
            const y0 = clamp(scalar(o.y, 0), 0, height);
            const x1 = clamp(scalar(o.x, 0) + scalar(o.width, 0), 0, width);
            const y1 = clamp(scalar(o.y, 0) + scalar(o.height, 0), 0, height);
            if (x1 <= x0 || y1 <= y0)
                continue;
            const intrusion = o.edge === 'top' ? y1 : o.edge === 'bottom' ? height - y0 : o.edge === 'left' ? x1 : width - x0;
            inset[o.edge] = Math.max(inset[o.edge], intrusion + padding);
        }
        const horizontal = axis(width, inset.left, inset.right);
        const vertical = axis(height, inset.top, inset.bottom);
        return frame(horizontal.start, vertical.start, horizontal.length, vertical.length);
    }
    function clippedFrame(value, width, height) {
        const f = object(value);
        const x = scalar(f.x, 0), y = scalar(f.y, 0);
        const w = positive(f.width, width), h = positive(f.height, height);
        let x0 = clamp(x, 0, width), x1 = clamp(x + w, 0, width);
        let y0 = clamp(y, 0, height), y1 = clamp(y + h, 0, height);
        if (x1 - x0 < 1) {
            x0 = clamp(x + w / 2 - 0.5, 0, width - 1);
            x1 = x0 + 1;
        }
        if (y1 - y0 < 1) {
            y0 = clamp(y + h / 2 - 0.5, 0, height - 1);
            y1 = y0 + 1;
        }
        return frame(x0, y0, x1 - x0, y1 - y0);
    }
    function fit(bounds, input) {
        const options = object(input), b = object(bounds);
        const width = dimension(options.width), height = dimension(options.height);
        const f = clippedFrame(options.frame, width, height);
        const padding = positive(options.padding, 0);
        const horizontal = axis(f.width, padding, padding), vertical = axis(f.height, padding, padding);
        const target = frame(f.x + horizontal.start, f.y + vertical.start, horizontal.length, vertical.length);
        const x0 = scalar(b.x0, 0), x1 = scalar(b.x1, x0);
        const y0 = scalar(b.y0, 0), y1 = scalar(b.y1, y0);
        const boundsWidth = Math.max(1, Math.abs(x1 - x0)), boundsHeight = Math.max(1, Math.abs(y1 - y0));
        const fill = clamp(scalar(options.fill, 0.94), 0.000001, 1);
        const viewportScale = Math.min(width, height) / 784;
        const fitted = Math.min(target.width / boundsWidth, target.height / boundsHeight) * fill / viewportScale;
        const minZoom = positive(options.minZoom, 0), maxZoom = Math.max(minZoom, positive(options.maxZoom, Infinity));
        const zoom = clamp(fitted, minZoom, maxZoom > 0 ? maxZoom : Infinity);
        const scale = zoom * viewportScale;
        return {
            zoom,
            px: (x0 + x1) / 2 - (target.cx - width / 2) / scale,
            py: (y0 + y1) / 2 - (target.cy - height / 2) / scale,
            scale
        };
    }
    function projectedBounds(rectangles, input) {
        const options = object(input);
        const originX = scalar(options.originX, 0), originY = scalar(options.originY, 0);
        let result = null;
        for (const value of Array.isArray(rectangles) ? rectangles : []) {
            const r = object(value);
            if (![r.x0, r.y0, r.x1, r.y1].every(Number.isFinite))
                continue;
            const ax = scalar(r.x0, 0) - originX, bx = scalar(r.x1, 0) - originX;
            const ay = scalar(r.y0, 0) - originY, by = scalar(r.y1, 0) - originY;
            if (!result)
                result = { x0: ax, y0: ay, x1: ax, y1: ay };
            result.x0 = Math.min(result.x0, ax, bx);
            result.x1 = Math.max(result.x1, ax, bx);
            result.y0 = Math.min(result.y0, ay, by);
            result.y1 = Math.max(result.y1, ay, by);
        }
        return result || { x0: 0, y0: 0, x1: 0, y1: 0 };
    }
    return Object.freeze({ safeFrame, fit, projectedBounds });
});
