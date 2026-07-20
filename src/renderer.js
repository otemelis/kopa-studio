import { carCells } from "./gameLogic.js";

const boardPadding = 28;

export function createRenderer(canvas) {
  const context = canvas.getContext("2d");
  return {
    canvas,
    context,
    metrics: null
  };
}

export function drawGame(renderer, game) {
  resizeCanvas(renderer.canvas);

  const { canvas, context } = renderer;
  const { cols, rows } = game.level.grid;
  const size = Math.min(canvas.width, canvas.height);
  const usable = size - boardPadding * 2;
  const cell = usable / Math.max(cols, rows);
  const origin = {
    x: (canvas.width - cell * cols) / 2,
    y: (canvas.height - cell * rows) / 2
  };

  renderer.metrics = { cell, origin };

  context.clearRect(0, 0, canvas.width, canvas.height);
  drawLot(context, game.level, origin, cell);
  drawExit(context, game.level, origin, cell);
  drawBarriers(context, game.level, origin, cell);
  game.cars.forEach((car) => drawCar(context, car, origin, cell, car.id === game.selectedCarId));
}

export function getBoardCell(renderer, pointerEvent) {
  if (!renderer.metrics) return null;

  const rect = renderer.canvas.getBoundingClientRect();
  const scaleX = renderer.canvas.width / rect.width;
  const scaleY = renderer.canvas.height / rect.height;
  const x = (pointerEvent.clientX - rect.left) * scaleX;
  const y = (pointerEvent.clientY - rect.top) * scaleY;
  const col = Math.floor((x - renderer.metrics.origin.x) / renderer.metrics.cell);
  const row = Math.floor((y - renderer.metrics.origin.y) / renderer.metrics.cell);
  return { col, row, x, y };
}

export function getDragDelta(renderer, startPoint, endPoint, orientation) {
  if (!renderer.metrics || !startPoint || !endPoint) return 0;

  const axisDelta = orientation === "h" ? endPoint.x - startPoint.x : endPoint.y - startPoint.y;
  return Math.trunc(axisDelta / renderer.metrics.cell);
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawLot(context, level, origin, cell) {
  context.fillStyle = "#3d4652";
  roundRect(context, origin.x, origin.y, cell * level.grid.cols, cell * level.grid.rows, 18);
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.13)";
  context.lineWidth = Math.max(1, cell * 0.025);

  for (let col = 1; col < level.grid.cols; col += 1) {
    drawLine(context, origin.x + col * cell, origin.y, origin.x + col * cell, origin.y + level.grid.rows * cell);
  }

  for (let row = 1; row < level.grid.rows; row += 1) {
    drawLine(context, origin.x, origin.y + row * cell, origin.x + level.grid.cols * cell, origin.y + row * cell);
  }
}

function drawExit(context, level, origin, cell) {
  if (level.exit.side !== "right") return;

  const x = origin.x + level.grid.cols * cell - cell * 0.08;
  const y = origin.y + level.exit.row * cell + cell * 0.12;
  context.fillStyle = "#53d083";
  roundRect(context, x, y, cell * 0.36, cell * 0.76, 8);
  context.fill();
}

function drawBarriers(context, level, origin, cell) {
  context.fillStyle = "#242b35";
  level.barriers.forEach((barrier) => {
    const gap = cell * 0.17;
    roundRect(context, origin.x + barrier.x * cell + gap, origin.y + barrier.y * cell + gap, cell - gap * 2, cell - gap * 2, 7);
    context.fill();
  });
}

function drawCar(context, car, origin, cell, selected) {
  const gap = cell * 0.11;
  const x = origin.x + car.x * cell + gap;
  const y = origin.y + car.y * cell + gap;
  const width = (car.orientation === "h" ? car.length : 1) * cell - gap * 2;
  const height = (car.orientation === "v" ? car.length : 1) * cell - gap * 2;

  context.save();
  context.shadowBlur = selected ? 18 : 8;
  context.shadowColor = selected ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.24)";
  context.fillStyle = car.color;
  roundRect(context, x, y, width, height, 10);
  context.fill();

  context.shadowBlur = 0;
  context.globalAlpha = 0.45;
  context.fillStyle = "#ffffff";
  if (car.orientation === "h") {
    roundRect(context, x + width * 0.18, y + height * 0.2, width * 0.24, height * 0.22, 4);
    context.fill();
    roundRect(context, x + width * 0.58, y + height * 0.2, width * 0.24, height * 0.22, 4);
    context.fill();
  } else {
    roundRect(context, x + width * 0.2, y + height * 0.18, width * 0.22, height * 0.24, 4);
    context.fill();
    roundRect(context, x + width * 0.2, y + height * 0.58, width * 0.22, height * 0.24, 4);
    context.fill();
  }
  context.restore();
}

function drawLine(context, x1, y1, x2, y2) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
