"use strict";
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
    const api = Object.freeze({ detailVisible, primaryRequest, placeAnnotation });
    if (typeof module === 'object' && module.exports)
        module.exports = api;
    if (root)
        root.CovenAtlasPresentation = api;
}(typeof window === 'object' ? window : null));
