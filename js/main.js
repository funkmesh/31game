import { GameEngine } from './game.js';
import { UIManager } from './ui.js';

const ui = new UIManager();
let engine = null;
let setupListenersAttached = false;

const newGameBtn = document.getElementById('new-game-btn');

// ===== SETUP SCREEN =====
function initSetup() {
  engine = null;
  newGameBtn.classList.add('hidden');
  document.getElementById('knock-banner').classList.add('hidden');
  ui.showSetup();

  // Only attach listeners once to avoid accumulation
  if (setupListenersAttached) return;
  setupListenersAttached = true;

  // Opponent count buttons
  const opponentBtns = document.querySelectorAll('.opponent-btn');
  opponentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      opponentBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      ui.selectedOpponents = parseInt(btn.dataset.count);
    });
  });

  // Default selection
  document.querySelector('.opponent-btn[data-count="3"]').classList.add('selected');

  // Difficulty buttons
  const diffBtns = document.querySelectorAll('.difficulty-btn');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      ui.selectedDifficulty = btn.dataset.difficulty;
    });
  });

  // Default selection
  document.querySelector('.difficulty-btn[data-difficulty="medium"]').classList.add('selected');

  // Start button
  document.getElementById('start-btn').addEventListener('click', startGame);
}

function startGame() {
  engine = new GameEngine(ui.selectedOpponents, ui.selectedDifficulty);
  ui.attachEngine(engine);
  ui.hideSetup();
  newGameBtn.classList.remove('hidden');
  engine.startGame();
}

function restartToSetup() {
  // Hide all overlays
  document.getElementById('round-overlay').classList.add('hidden');
  document.getElementById('gameover-overlay').classList.add('hidden');
  initSetup();
}

// ===== IN-GAME BUTTONS =====
document.getElementById('knock-btn').addEventListener('click', () => {
  if (engine) engine.knock();
});

document.getElementById('next-round-btn').addEventListener('click', () => {
  document.getElementById('round-overlay').classList.add('hidden');
  if (engine) engine.proceedAfterRound();
});

document.getElementById('play-again-btn').addEventListener('click', restartToSetup);

// "New Game" button on round results overlay
document.getElementById('round-new-game-btn').addEventListener('click', restartToSetup);

// "New Game" button in header (mid-round restart)
newGameBtn.addEventListener('click', () => {
  if (confirm('Start a new game? Current progress will be lost.')) {
    restartToSetup();
  }
});

// ===== INIT =====
initSetup();
