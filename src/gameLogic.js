export function createGame(level) {
  return {
    level,
    cars: level.cars.map((car) => ({ ...car })),
    moves: 0,
    won: false,
    selectedCarId: null
  };
}

export function getCarAt(game, col, row) {
  return game.cars.find((car) => carCells(car).some((cell) => cell.x === col && cell.y === row));
}

export function moveCar(game, carId, delta) {
  if (game.won || delta === 0) return false;

  const car = game.cars.find((candidate) => candidate.id === carId);
  if (!car) return false;

  const direction = Math.sign(delta);
  const steps = Math.abs(delta);
  let moved = false;

  for (let index = 0; index < steps; index += 1) {
    if (!canMoveOneCell(game, car, direction)) break;

    if (car.orientation === "h") car.x += direction;
    if (car.orientation === "v") car.y += direction;
    moved = true;
  }

  if (moved) {
    game.won = isTargetEscaped(game, car);
  }

  return moved;
}

export function getStars(level, moves) {
  if (moves <= level.starMoves[0]) return 3;
  if (moves <= level.starMoves[1]) return 2;
  return 1;
}

function canMoveOneCell(game, car, direction) {
  const nextCells = nextCarCells(car, direction);

  return nextCells.every((cell) => {
    if (canUseExit(game.level, car, cell)) return true;
    if (!isInsideGrid(game.level.grid, cell)) return false;
    if (isBarrier(game.level, cell)) return false;
    return !isOccupied(game, car.id, cell);
  });
}

function nextCarCells(car, direction) {
  const next = { ...car };
  if (car.orientation === "h") next.x += direction;
  if (car.orientation === "v") next.y += direction;
  return carCells(next);
}

function canUseExit(level, car, cell) {
  return (
    car.target === true &&
    level.exit.side === "right" &&
    car.orientation === "h" &&
    car.y === level.exit.row &&
    cell.y === level.exit.row &&
    cell.x === level.grid.cols
  );
}

function isTargetEscaped(game, car) {
  return car.target === true && car.orientation === "h" && car.x + car.length >= game.level.grid.cols;
}

function isInsideGrid(grid, cell) {
  return cell.x >= 0 && cell.x < grid.cols && cell.y >= 0 && cell.y < grid.rows;
}

function isBarrier(level, cell) {
  return level.barriers.some((barrier) => barrier.x === cell.x && barrier.y === cell.y);
}

function isOccupied(game, movingCarId, cell) {
  return game.cars.some((car) => {
    if (car.id === movingCarId) return false;
    return carCells(car).some((occupied) => occupied.x === cell.x && occupied.y === cell.y);
  });
}

export function carCells(car) {
  return Array.from({ length: car.length }, (_, offset) => ({
    x: car.x + (car.orientation === "h" ? offset : 0),
    y: car.y + (car.orientation === "v" ? offset : 0)
  }));
}
