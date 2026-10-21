const cube = document.querySelector('.number-cube');

document.querySelector('.hero-game').addEventListener('pointermove', (event) => {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - .5;
  cube.style.transform = `rotate(${-6 + x * 7}deg)`;
});

const rail = document.querySelector('[data-shot-rail]');
let isDown = false, startX = 0, initialScroll = 0;
rail.addEventListener('pointerdown', (event) => { isDown = true; startX = event.clientX; initialScroll = rail.scrollLeft; rail.setPointerCapture(event.pointerId); });
rail.addEventListener('pointermove', (event) => { if (isDown) rail.scrollLeft = initialScroll - (event.clientX - startX); });
rail.addEventListener('pointerup', () => { isDown = false; });
