import { getStars } from "./gameLogic.js";

export function createUi() {
  return {
    levelTitle: document.querySelector("#level-title"),
    moveCount: document.querySelector("#move-count"),
    hint: document.querySelector("#hint"),
    winPanel: document.querySelector("#win-panel"),
    winTitle: document.querySelector("#win-title"),
    stars: document.querySelector("#stars"),
    restartButton: document.querySelector("#restart-button"),
    nextButton: document.querySelector("#next-button")
  };
}

export function updateUi(ui, game, levelIndex, totalLevels) {
  ui.levelTitle.textContent = `Level ${levelIndex + 1}: ${game.level.name}`;
  ui.moveCount.textContent = game.moves;

  if (game.won) {
    const starCount = getStars(game.level, game.moves);
    ui.winPanel.classList.remove("hidden");
    ui.winTitle.textContent = levelIndex + 1 === totalLevels ? "All lots cleared!" : "You escaped!";
    ui.stars.textContent = "★".repeat(starCount) + "☆".repeat(3 - starCount);
    ui.nextButton.textContent = levelIndex + 1 === totalLevels ? "Replay from level 1" : "Next level";
    ui.hint.textContent = `${starCount} star${starCount === 1 ? "" : "s"} in ${game.moves} moves.`;
  } else {
    ui.winPanel.classList.add("hidden");
    ui.hint.textContent = "Drag the red car to the exit.";
  }
}
