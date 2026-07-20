import { levels } from "../src/levels.js";
import { carCells } from "../src/gameLogic.js";

let hasError = false;

for (const level of levels) {
  const occupied = new Map();

  for (const barrier of level.barriers) {
    assertInside(level, barrier, `barrier ${barrier.x},${barrier.y}`);
    occupied.set(`${barrier.x},${barrier.y}`, "barrier");
  }

  for (const car of level.cars) {
    for (const cell of carCells(car)) {
      assertInside(level, cell, `car ${car.id}`);
      const key = `${cell.x},${cell.y}`;
      if (occupied.has(key)) {
        report(`Level ${level.id}: ${car.id} overlaps ${occupied.get(key)} at ${key}`);
      }
      occupied.set(key, car.id);
    }
  }

  const targetCount = level.cars.filter((car) => car.target).length;
  if (targetCount !== 1) report(`Level ${level.id}: expected one target car, found ${targetCount}`);
}

if (hasError) process.exit(1);
console.log(`Checked ${levels.length} levels.`);

function assertInside(level, cell, label) {
  const inside = cell.x >= 0 && cell.x < level.grid.cols && cell.y >= 0 && cell.y < level.grid.rows;
  if (!inside) report(`Level ${level.id}: ${label} is outside the grid`);
}

function report(message) {
  hasError = true;
  console.error(message);
}
