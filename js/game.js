import { Deck } from './deck.js';
import { Player } from './player.js';
import { isInstantWin, isAllSameSuit } from './scorer.js';
import { decideAction, chooseDiscard } from './ai.js';
import { AI_NAMES, DIFFICULTY } from './constants.js';

export class GameEngine {
  constructor(opponentCount, difficulty) {
    this.difficulty = difficulty;
    this.players = [new Player('You', true)];
    for (let i = 0; i < opponentCount; i++) {
      this.players.push(new Player(AI_NAMES[i], false));
    }
    this.deck = new Deck();
    this.discardPile = [];
    this.currentPlayerIndex = 0;
    this.knocker = null;
    this.turnsAfterKnock = 0;
    this.turnsPlayed = 0;
    this.roundNumber = 0;
    this.phase = 'setup'; // setup, playerTurn, discarding, roundEnd, gameOver
    this.gameOver = false;
    this._animating = false; // lock to prevent actions during animation

    // Callbacks — set by UI
    this.onStateChange = null;
    this.onRoundEnd = null;
    this.onGameOver = null;
    this.onInstantWin = null;
    this.onMessage = null;
    this.onPlayerAction = null;
    this.onRoundStart = null;
    // Animation callback: (type, player, card, source, done) => void
    // type: 'draw' | 'discard'
    // source: 'stock' | 'discard' (for draw type)
    // done: callback to invoke when animation completes
    this.onAnimateCard = null;
  }

  get activePlayers() {
    return this.players.filter(p => !p.isEliminated);
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  get discardTop() {
    return this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null;
  }

  startGame() {
    this.startRound();
  }

  startRound() {
    this.roundNumber++;
    this.knocker = null;
    this.turnsAfterKnock = 0;
    this.turnsPlayed = 0;
    this.discardPile = [];

    for (const player of this.players) {
      player.resetForRound();
    }

    this.deck.reset();
    this.deck.shuffle();

    // Deal 3 cards to each active player
    for (let i = 0; i < 3; i++) {
      for (const player of this.activePlayers) {
        player.addCard(this.deck.draw());
      }
    }

    // Flip one card to start discard pile
    this.discardPile.push(this.deck.draw());

    // Check for instant win after dealing
    for (const player of this.activePlayers) {
      if (player.hasInstantWin()) {
        this._handleInstantWin(player);
        return;
      }
    }

    // Start with first active player
    this.currentPlayerIndex = this._findNextActivePlayer(-1);
    this.phase = 'playerTurn';
    if (this.onRoundStart) this.onRoundStart();
    this._emitStateChange();
    this._emitMessage(`Round ${this.roundNumber} begins!`);

    if (!this.currentPlayer.isHuman) {
      this._scheduleAITurn();
    }
  }

  // Human draws from stock — returns the drawn card for animation
  drawFromStock() {
    if (this.phase !== 'playerTurn' || this._animating) return null;

    this._ensureStockHasCards();
    const card = this.deck.draw();
    if (!card) return null;

    this.currentPlayer.addCard(card);

    // Check instant win after draw
    if (this.currentPlayer.hasInstantWin()) {
      this._autoDiscardForInstantWin(this.currentPlayer);
      this._handleInstantWin(this.currentPlayer);
      return card;
    }

    this.phase = 'discarding';
    this._emitStateChange();
    return card;
  }

  // Human draws from discard — returns the drawn card for animation
  drawFromDiscard() {
    if (this.phase !== 'playerTurn' || this._animating) return null;
    if (this.discardPile.length === 0) return null;

    const card = this.discardPile.pop();
    this.currentPlayer.addCard(card);

    // Check instant win after draw
    if (this.currentPlayer.hasInstantWin()) {
      this._autoDiscardForInstantWin(this.currentPlayer);
      this._handleInstantWin(this.currentPlayer);
      return card;
    }

    this.phase = 'discarding';
    this._emitStateChange();
    return card;
  }

  discard(cardIndex) {
    if (this.phase !== 'discarding') return null;

    const card = this.currentPlayer.removeCard(cardIndex);
    this.discardPile.push(card);
    this.turnsPlayed++;

    this._advanceTurn();
    return card;
  }

  knock() {
    if (this.phase !== 'playerTurn' || this._animating) return;
    if (this.knocker) return; // someone already knocked
    if (!isAllSameSuit(this.currentPlayer.hand)) {
      if (this.currentPlayer.isHuman) {
        this._emitMessage('You can only knock if all 3 cards are the same suit!');
      }
      return;
    }

    this.knocker = this.currentPlayer;
    this.currentPlayer.knocked = true;
    this.turnsAfterKnock = 0;
    this.turnsPlayed++;

    this._emitMessage(`${this.currentPlayer.name} knocks!`, 'knock');
    if (!this.currentPlayer.isHuman) {
      this._emitPlayerAction(this.currentPlayer.name, 'KNOCKS!', true);
    }
    this._emitStateChange();

    // Pause to show knock, then advance
    setTimeout(() => {
      this._advanceTurn();
    }, 1500);
  }

  _advanceTurn() {
    this.currentPlayerIndex = this._findNextActivePlayer(this.currentPlayerIndex);
    // Skip the knocker
    if (this.knocker && this.currentPlayer === this.knocker) {
      this.currentPlayerIndex = this._findNextActivePlayer(this.currentPlayerIndex);
    }

    if (this.knocker) {
      this.turnsAfterKnock++;
      const othersCount = this.activePlayers.length - 1;
      if (this.turnsAfterKnock > othersCount) {
        this._endRound();
        return;
      }
    }

    this.phase = 'playerTurn';
    this._emitStateChange();

    if (!this.currentPlayer.isHuman) {
      // 1 second pause between players so actions linger
      setTimeout(() => this._scheduleAITurn(), 1000);
    }
  }

  _scheduleAITurn() {
    const delay = 400 + Math.random() * 300;
    setTimeout(() => this._executeAITurn(), delay);
  }

  _executeAITurn() {
    const player = this.currentPlayer;
    if (player.isHuman || player.isEliminated) return;

    const gameState = {
      difficulty: this.difficulty,
      knocker: this.knocker,
      turnsPlayed: this.turnsPlayed,
      activePlayers: this.activePlayers
    };

    const decision = decideAction(player, this.discardTop, gameState);

    if (decision.action === 'knock') {
      this.knock();
      return;
    }

    this._animating = true;

    // Step 1: Draw
    let drawnCard;
    let drawSource;
    if (decision.source === 'discard' && this.discardPile.length > 0) {
      drawSource = 'discard';
      drawnCard = this.discardPile.pop();
      player.addCard(drawnCard);
    } else {
      drawSource = 'stock';
      this._ensureStockHasCards();
      drawnCard = this.deck.draw();
      if (!drawnCard) { this._animating = false; return; }
      player.addCard(drawnCard);
    }

    // Check instant win
    if (player.hasInstantWin()) {
      this._animating = false;
      this._autoDiscardForInstantWin(player);
      this._handleInstantWin(player);
      return;
    }

    this.phase = 'discarding';

    // Animate the draw
    const afterDraw = () => {
      this._emitStateChange();

      // Step 2: Choose discard
      const discardIndex = decision.discardIndex !== null
        ? decision.discardIndex
        : chooseDiscard(player, this.difficulty);

      const safeIndex = Math.min(discardIndex, player.hand.length - 1);
      const discardedCard = player.hand[safeIndex];
      const cardName = discardedCard ? discardedCard.toString() : '';
      const drawMsg = drawSource === 'discard' ? 'Drew from discard' : 'Drew from stock';

      // Brief pause to show 4-card hand, then discard
      setTimeout(() => {
        // Remove from hand and add to discard pile
        const card = player.removeCard(safeIndex);
        this.discardPile.push(card);
        this.turnsPlayed++;

        // Animate the discard
        const afterDiscard = () => {
          this._animating = false;
          this._emitPlayerAction(player.name, `${drawMsg} · Discarded ${cardName}`);
          this._emitStateChange();
          this._doAdvanceTurn();
        };

        if (this.onAnimateCard) {
          this.onAnimateCard('discard', player, card, null, afterDiscard);
        } else {
          afterDiscard();
        }
      }, 400);
    };

    if (this.onAnimateCard) {
      this.onAnimateCard('draw', player, drawnCard, drawSource, afterDraw);
    } else {
      afterDraw();
    }
  }

  // Same as _advanceTurn but called from animated AI flow (skips scheduling delay in _advanceTurn)
  _doAdvanceTurn() {
    this.currentPlayerIndex = this._findNextActivePlayer(this.currentPlayerIndex);
    if (this.knocker && this.currentPlayer === this.knocker) {
      this.currentPlayerIndex = this._findNextActivePlayer(this.currentPlayerIndex);
    }

    if (this.knocker) {
      this.turnsAfterKnock++;
      const othersCount = this.activePlayers.length - 1;
      if (this.turnsAfterKnock > othersCount) {
        this._endRound();
        return;
      }
    }

    this.phase = 'playerTurn';
    this._emitStateChange();

    if (!this.currentPlayer.isHuman) {
      // 1 second pause between AI players
      setTimeout(() => this._scheduleAITurn(), 1000);
    }
  }

  _endRound() {
    this.phase = 'roundEnd';

    const results = this.activePlayers.map(p => ({
      player: p,
      ...p.getHandScore()
    }));

    const lowestScore = Math.min(...results.map(r => r.score));
    const losers = results.filter(r => r.score === lowestScore).map(r => r.player);

    for (const loser of losers) {
      loser.loseLife();
    }

    this._emitStateChange();

    if (this.onRoundEnd) {
      this.onRoundEnd({ results, losers, lowestScore });
    }
  }

  proceedAfterRound() {
    const remaining = this.activePlayers;
    if (remaining.length <= 1) {
      this.phase = 'gameOver';
      this.gameOver = true;
      if (this.onGameOver) {
        this.onGameOver(remaining[0] || null);
      }
      return;
    }

    this.startRound();
  }

  _handleInstantWin(winner) {
    this.phase = 'roundEnd';

    const results = this.activePlayers.map(p => ({
      player: p,
      ...p.getHandScore()
    }));

    for (const player of this.activePlayers) {
      if (player !== winner) {
        player.loseLife();
      }
    }

    this._emitStateChange();

    if (this.onInstantWin) {
      this.onInstantWin({ winner, results });
    }
  }

  _autoDiscardForInstantWin(player) {
    if (player.hand.length <= 3) return;
    for (let i = 0; i < player.hand.length; i++) {
      const remaining = player.hand.filter((_, idx) => idx !== i);
      if (isInstantWin(remaining)) {
        const discarded = player.removeCard(i);
        this.discardPile.push(discarded);
        return;
      }
    }
  }

  _findNextActivePlayer(fromIndex) {
    let idx = fromIndex;
    for (let i = 0; i < this.players.length; i++) {
      idx = (idx + 1) % this.players.length;
      if (!this.players[idx].isEliminated) {
        return idx;
      }
    }
    return fromIndex;
  }

  _ensureStockHasCards() {
    if (this.deck.remaining > 0) return;
    if (this.discardPile.length <= 1) return;

    const topCard = this.discardPile.pop();
    this.deck.addCards(this.discardPile);
    this.discardPile = [topCard];
    this.deck.shuffle();
  }

  _emitStateChange() {
    if (this.onStateChange) this.onStateChange();
  }

  _emitMessage(text, type = '') {
    if (this.onMessage) this.onMessage(text, type);
  }

  _emitPlayerAction(playerName, text, isKnock = false) {
    if (this.onPlayerAction) this.onPlayerAction(playerName, text, isKnock);
  }
}
