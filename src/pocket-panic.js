const screen = document.querySelector('.phone-screen');
const pip = document.querySelector('#pip');
const route = document.querySelector('#drawn-route');
let active = false;

function rescue() {
  screen.classList.add('active');
  pip.animate([
    { transform: 'translate(0 0)' },
    { transform: 'translate(37px -59px)' },
    { transform: 'translate(67px -158px)' },
    { transform: 'translate(150px -215px)' },
    { transform: 'translate(226px -327px)' }
  ], { duration: 1450, easing: 'cubic-bezier(.42,0,.27,1)', fill: 'forwards' });
}

screen.addEventListener('pointerdown', (event) => {
  active = true;
  screen.setPointerCapture(event.pointerId);
  rescue();
});
screen.addEventListener('pointermove', (event) => { if (active) rescue(); });
screen.addEventListener('pointerup', () => { active = false; });
setTimeout(rescue, 700);
