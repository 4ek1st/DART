(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DartArtworkGestures = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function create({ resolve, like, delay = 300, movement = 8,
    schedule = setTimeout, unschedule = clearTimeout }) {
    let pending = null, pointer = null;
    const primary = event => (event.button ?? 0) === 0 &&
      !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey &&
      (!event.pointerType || event.pointerType === 'mouse');
    const same = (a, b) => a && b && a.context === b.context && a.target === b.target;
    const valid = choice => !choice.valid || choice.valid();
    const discard = () => {
      if (pending) unschedule(pending.timer);
      pending = null;
    };
    const cancel = () => { discard(); pointer = null; };

    return {
      cancel,
      pointerdown(event) {
        const choice = primary(event) && resolve(event);
        if (!choice) { cancel(); return; }
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      },
      pointermove(event) {
        if (!pointer || event.pointerId !== pointer.id) return;
        if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > movement) {
          pointer.moved = true;
          discard();
        }
      },
      click(event) {
        // Keyboard activation, touch and modified clicks keep their original actions.
        if (!primary(event) || event.detail === 0) { cancel(); return false; }
        const choice = resolve(event);
        if (!choice) { cancel(); return false; }
        const dragged = pointer?.moved;
        pointer = null;
        event.preventDefault();
        if (dragged || !valid(choice)) { discard(); return true; }
        const previous = pending;
        discard();
        const timely = !Number.isFinite(event.timeStamp) || !Number.isFinite(previous?.at) ||
          event.timeStamp - previous.at <= delay;
        if (same(previous?.choice, choice) && timely && valid(previous.choice) &&
            Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= movement) {
          like(choice.item, event);
          return true;
        }
        // The remaining clicks in a triple/quadruple click must not open a viewer.
        if (event.detail > 1) return true;
        const next = { choice, x: event.clientX, y: event.clientY, at: event.timeStamp };
        pending = next;
        next.timer = schedule(() => {
          if (pending !== next) return;
          pending = null;
          if (valid(choice)) choice.single?.();
        }, delay);
        return true;
      },
      dblclick(event) {
        if (!primary(event) || !resolve(event)) return false;
        event.preventDefault();
        return true;
      }
    };
  }

  return { create };
});
