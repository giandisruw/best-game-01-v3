// EMBERDEEP — keyboard and mouse input.
// One clear job: turn DOM events into a clean per-frame input state, with
// edge-triggered "just pressed" keys and a click queue the screens consume.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since last frame, edge-triggered
  const clicks = []; // {x, y, button} in canvas coordinates, consumed by screens
  const mouse = { x: 0, y: 0, left: false, right: false };

  function canvasPos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      event.preventDefault();
    }
    if (!keys.has(key)) pressed.add(key);
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.left = false;
    mouse.right = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const p = canvasPos(event);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = canvasPos(event);
    if (event.button === 0) mouse.left = true;
    if (event.button === 2) mouse.right = true;
    clicks.push({ x: p.x, y: p.y, button: event.button });
    event.preventDefault();
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.left = false;
    if (event.button === 2) mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    keys,
    // true while the key is held down
    down(...names) {
      return names.some((n) => keys.has(n));
    },
    // true only on the frame the key went down
    wasPressed(...names) {
      return names.some((n) => pressed.has(n));
    },
    // drain the click queue (screens read it once per frame)
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
    // end of frame: forget edge presses
    endFrame() {
      pressed.clear();
    },
  };
}
