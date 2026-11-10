const ride = document.querySelector('.ride');
const slots = [...ride.querySelectorAll('.slot')];
const controls = document.querySelector('.controls');
const stops = [...controls.querySelectorAll('.stops button')];
const status = document.querySelector('[role="status"]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const svgNamespace = 'http://www.w3.org/2000/svg';
const turn = 2 * Math.PI;
const step = turn / slots.length;
let selected = 0;
let position = 0;
let target = 0;
let frame = 0;
let lastFrame = 0;
let gesture;
let suppressClickUntil = 0;

function svg(parent, tag, attributes) {
  const node = document.createElementNS(svgNamespace, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  parent.append(node);
  return node;
}

function makeHardware(selector, count, draw) {
  const layer = ride.querySelector(selector);
  return Array.from({ length: count }, (_, index) => draw(layer, index));
}

const spokes = makeHardware('.floor-spokes', 10, (layer) => svg(layer, 'line', {
  x1: 300, y1: 375, stroke: '#ffc28c', 'stroke-opacity': .34,
}));

const baseLights = makeHardware('.floor-lights', 20, (layer, index) => svg(layer, 'circle', {
  r: 2.7, fill: index % 2 === 0 ? '#ffdeb1' : '#f5a297',
}));

const poles = makeHardware('.poles', slots.length, (layer) => svg(layer, 'line', {
  stroke: 'url(#gold)', 'stroke-width': 4.5, 'stroke-linecap': 'round',
}));

const roofTrim = ride.querySelector('.roof-trim');
const panels = makeHardware('.roof-panels', 14, (layer, index) => ({
  panel: svg(layer, 'path', { fill: index % 2 === 0 ? 'url(#red)' : 'url(#cream)' }),
  trim: svg(roofTrim, 'path', { fill: index % 2 === 0 ? '#aa4a5c' : '#e6b592', stroke: '#7d384c', 'stroke-width': .7 }),
  lamp: svg(roofTrim, 'circle', { r: 3, fill: '#fff0c2', stroke: '#f7ba7f', 'stroke-width': 1.5 }),
}));

function place(point, x, y) {
  point.setAttribute('cx', x);
  point.setAttribute('cy', y);
}

function roofPoint(angle) {
  return { x: 300 + 249 * Math.sin(angle), y: 128 + 31 * Math.cos(angle) };
}

function roofEdge(point) {
  const dx = point.x - 300;
  return `C${300 + dx * .28} 60 ${300 + dx * .8} ${point.y - 16} ${point.x} ${point.y}`;
}

function drawRoof(rotation) {
  const segment = turn / panels.length;
  panels.forEach(({ panel, trim, lamp }, index) => {
    const middle = ((index * segment + rotation + Math.PI) % turn + turn) % turn - Math.PI;
    const start = Math.max(-Math.PI / 2, middle - segment / 2);
    const end = Math.min(Math.PI / 2, middle + segment / 2);
    panel.style.display = trim.style.display = end > start ? '' : 'none';
    lamp.style.display = Math.abs(middle) < Math.PI / 2 ? '' : 'none';
    if (end <= start) return;

    const a = roofPoint(start);
    const b = roofPoint(end);
    const dx = a.x - 300;
    panel.setAttribute('d', `M300 31${roofEdge(b)}A249 31 0 0 1 ${a.x} ${a.y}C${300 + dx * .8} ${a.y - 16} ${300 + dx * .28} 60 300 31Z`);
    trim.setAttribute('d', `M${a.x} ${a.y}A249 31 0 0 0 ${b.x} ${b.y}l0 9Q${(a.x + b.x) / 2} ${Math.max(a.y, b.y) + 23} ${a.x} ${a.y + 9}Z`);
    const point = roofPoint(middle);
    place(lamp, point.x, point.y + 9);
  });
}

function render() {
  const rotation = -position * step;
  slots.forEach((slot, index) => {
    const angle = index * step + rotation;
    const depth = Math.cos(angle);
    const x = 300 + 190 * Math.sin(angle);
    const y = 317 + depth * 17;
    slot.style.left = `${x / 6}%`;
    slot.style.top = `${y / 5.4}%`;
    slot.style.transform = `translate(-50%, -50%) scale(${.88 + depth * .17})`;
    slot.style.zIndex = Math.round(105 + depth * 100);
    slot.style.opacity = .9 + Math.max(0, depth) * .1;

    const pole = poles[index];
    pole.setAttribute('x1', x);
    pole.setAttribute('x2', x);
    pole.setAttribute('y1', 132 + depth * 21);
    pole.setAttribute('y2', 465 + depth * 28);
  });

  spokes.forEach((spoke, index) => {
    const angle = rotation + index * turn / spokes.length;
    spoke.setAttribute('x2', 300 + Math.sin(angle) * 220);
    spoke.setAttribute('y2', 375 + Math.cos(angle) * 32);
  });

  baseLights.forEach((light, index) => {
    const angle = rotation + index * turn / baseLights.length;
    const depth = Math.cos(angle);
    light.style.display = depth >= 0 ? '' : 'none';
    place(light, 300 + Math.sin(angle) * 244, 382 + depth * 44);
  });
  drawRoof(rotation);
}

function animate(now) {
  const elapsed = lastFrame ? Math.min(now - lastFrame, 40) : 16;
  lastFrame = now;
  if (Math.abs(target - position) < .002 || reducedMotion.matches) {
    position = target;
    frame = lastFrame = 0;
  } else {
    position += (target - position) * (1 - Math.exp(-elapsed / 69));
    frame = requestAnimationFrame(animate);
  }
  render();
}

function wrap(index) {
  return (index % slots.length + slots.length) % slots.length;
}

function select(next, announce = true) {
  const previous = wrap(selected);
  selected = next;
  target = next;
  const current = wrap(selected);
  const moveFocus = previous !== current && slots[previous].contains(document.activeElement);
  slots.forEach((slot, index) => {
    slot.classList.toggle('is-current', index === current);
    slot.firstElementChild.tabIndex = index === current ? 0 : -1;
    stops[index].toggleAttribute('aria-current', index === current);
    if (index === current) stops[index].setAttribute('aria-current', 'true');
  });
  if (moveFocus) slots[current].firstElementChild.focus({ preventScroll: true });
  if (announce) status.textContent = `${current + 1} / ${slots.length} · ${slots[current].querySelector('strong').textContent}${current === 0 ? '' : ' · 준비 중'}`;
  if (!frame) frame = requestAnimationFrame(animate);
}

function goTo(index) {
  const midpoint = Math.floor(slots.length / 2);
  const offset = wrap(index - wrap(selected) + midpoint) - midpoint;
  select(selected + offset);
}

controls.querySelector('.previous').addEventListener('click', () => select(selected - 1));
controls.querySelector('.next').addEventListener('click', () => select(selected + 1));
stops.forEach((stop, index) => stop.addEventListener('click', () => goTo(index)));
slots.forEach((slot, index) => {
  if (index !== 0) slot.firstElementChild.addEventListener('click', () => goTo(index));
});

document.querySelector('.carousel').addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  select(selected + (event.key === 'ArrowRight' ? 1 : -1));
});

ride.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  gesture = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    origin: position,
    width: ride.clientWidth * .32,
    dragging: false,
  };
});

ride.addEventListener('pointermove', (event) => {
  if (gesture?.id !== event.pointerId) return;
  const dx = event.clientX - gesture.startX;
  if (!gesture.dragging) {
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(event.clientY - gesture.startY)) return;
    gesture.dragging = true;
    ride.setPointerCapture(event.pointerId);
    ride.classList.add('is-dragging');
    cancelAnimationFrame(frame);
    frame = lastFrame = 0;
  }
  if (!reducedMotion.matches) {
    position = gesture.origin - dx / gesture.width;
    render();
  }
});

function finishGesture(event) {
  if (gesture?.id !== event.pointerId) return;
  const { startX, origin, width, dragging } = gesture;
  gesture = undefined;
  if (!dragging) return;
  ride.classList.remove('is-dragging');
  suppressClickUntil = performance.now() + 250;
  if (event.type !== 'pointerup') {
    select(selected, false);
    return;
  }
  const distance = (startX - event.clientX) / width;
  const closest = Math.round(origin + distance);
  const next = Math.abs(distance) > .22 && closest === selected ? selected + Math.sign(distance) : closest;
  select(next);
}

window.addEventListener('pointerup', finishGesture);
window.addEventListener('pointercancel', finishGesture);
ride.addEventListener('lostpointercapture', (event) => {
  if (event.target === ride) finishGesture(event);
});
ride.addEventListener('click', (event) => {
  if (!event.detail || performance.now() >= suppressClickUntil) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

function makeParticles(layer, count, setup) {
  const particles = document.createDocumentFragment();
  for (let index = 0; index < count; index++) {
    const particle = document.createElement('i');
    const properties = setup(particle, index);
    for (const [name, value] of Object.entries(properties)) particle.style.setProperty(`--${name}`, value);
    particles.append(particle);
  }
  document.querySelector(layer).append(particles);
}

makeParticles('.stars', 32, (star, index) => {
  const bright = index % 8 === 0;
  star.className = bright ? 'star is-bright' : 'star';
  return { x: `${(index * 63 + 8) % 97}%`, y: `${(index * 29 + 3) % 46}%`, size: bright ? '9px' : `${1 + index % 3}px`, speed: `${2 + index % 4}s`, delay: `${-(index % 7) / 2}s` };
});

function addSnow(layer, count, near) {
  makeParticles(layer, count, (flake, index) => {
    flake.className = 'flake';
    const speed = (near ? 7 : 12) + index % 11;
    const phase = (index * .618 + (near ? .28 : .1)) % 1;
    return {
      x: `${(index * 37.3 + (near ? 19 : 2)) % 99}%`,
      y: `${phase * 98}vh`,
      size: `${(near ? 2.5 : 1) + index % 4 * .65}px`,
      opacity: (near ? .43 : .25) + index % 4 * .11,
      speed: `${speed}s`,
      delay: `${-phase * speed}s`,
      drift: `${-21 + index % 9 * 9}px`,
    };
  });
}

addSnow('.snow-far', 48, false);
addSnow('.snow-near', 16, true);

select(0, false);
render();
controls.hidden = false;
ride.classList.add('is-ready');
