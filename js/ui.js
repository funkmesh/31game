import { SUIT_SYMBOLS, SUIT_COLORS, STARTING_LIVES } from './constants.js';

export class UIManager {
  constructor() {
    this.engine = null;
    this.elements = {
      setupOverlay: document.getElementById('setup-overlay'),
      roundOverlay: document.getElementById('round-overlay'),
      gameoverOverlay: document.getElementById('gameover-overlay'),
      gameTable: document.getElementById('game-table'),
      opponentsArea: document.getElementById('opponents-area'),
      humanArea: document.getElementById('human-area'),
      humanHand: document.getElementById('human-hand'),
      humanLives: document.getElementById('human-lives'),
      humanName: document.getElementById('human-name'),
      stockPile: document.getElementById('stock-pile'),
      discardPile: document.getElementById('discard-pile'),
      knockBtn: document.getElementById('knock-btn'),
      knockBanner: document.getElementById('knock-banner'),
      messageBar: document.getElementById('message-bar'),
      roundInfo: document.getElementById('round-info'),
      roundResultsList: document.getElementById('round-results-list'),
      roundResultTitle: document.getElementById('round-result-title'),
      nextRoundBtn: document.getElementById('next-round-btn'),
      gameoverTitle: document.getElementById('gameover-title'),
      gameoverWinner: document.getElementById('gameover-winner'),
      playAgainBtn: document.getElementById('play-again-btn'),
      flyingCard: document.getElementById('flying-card'),
    };

    // Stable DOM references for each opponent (keyed by player name)
    this._opponentElements = {};

    // Setup selections
    this.selectedOpponents = 3;
    this.selectedDifficulty = 'medium';
  }

  attachEngine(engine) {
    this.engine = engine;
    this._opponentElements = {};
    this.elements.opponentsArea.innerHTML = '';
    engine.onStateChange = () => this.render();
    engine.onRoundEnd = (data) => this.showRoundResults(data);
    engine.onGameOver = (winner) => this.showGameOver(winner);
    engine.onInstantWin = (data) => this.showInstantWin(data);
    engine.onMessage = (text, type) => this.showMessage(text, type);
    engine.onPlayerAction = (name, text, isKnock) => this.showPlayerAction(name, text, isKnock);
    engine.onRoundStart = () => this.clearAllActions();
    engine.onAnimateCard = (type, player, card, source, done) => {
      this.animateCard(type, player, card, source, done);
    };
  }

  // ===== SETUP =====
  showSetup() {
    this.elements.setupOverlay.classList.remove('hidden');
    this.elements.roundOverlay.classList.add('hidden');
    this.elements.gameoverOverlay.classList.add('hidden');
    this.elements.gameTable.classList.add('hidden');
  }

  hideSetup() {
    this.elements.setupOverlay.classList.add('hidden');
    this.elements.gameTable.classList.remove('hidden');
  }

  // ===== RENDERING =====
  render() {
    if (!this.engine) return;

    const engine = this.engine;
    this.elements.roundInfo.textContent = `Round ${engine.roundNumber}`;

    this._ensureOpponentNodes();

    for (const player of engine.players) {
      if (player.isHuman) continue;
      this._updateOpponentArea(player);
    }

    this._renderHumanArea();
    this._renderStockPile();
    this._renderDiscardPile();
    this._updateKnockButton();
    this._updateKnockBanner();

    // Show helpful message for human turn
    const human = engine.players.find(p => p.isHuman);
    if (engine.currentPlayer === human) {
      if (engine.phase === 'playerTurn') {
        if (engine.knocker && engine.knocker !== human) {
          this.showMessage('FINAL TURN! Someone knocked — make your last move!');
        } else if (!engine.knocker) {
          this.showMessage('Your turn — draw from stock, discard pile, or knock.');
        }
      } else if (engine.phase === 'discarding') {
        this.showMessage('Choose a card to discard.');
      }
    }
  }

  _ensureOpponentNodes() {
    const opponents = this.engine.players.filter(p => !p.isHuman);
    for (const player of opponents) {
      if (this._opponentElements[player.name]) continue;

      const area = document.createElement('div');
      area.className = 'player-area';

      const nameEl = document.createElement('div');
      nameEl.className = 'player-name';
      area.appendChild(nameEl);

      const livesEl = document.createElement('div');
      livesEl.className = 'lives-display';
      area.appendChild(livesEl);

      const hand = document.createElement('div');
      hand.className = 'hand';
      area.appendChild(hand);

      const actionEl = document.createElement('div');
      actionEl.className = 'player-action';
      area.appendChild(actionEl);

      this.elements.opponentsArea.appendChild(area);
      this._opponentElements[player.name] = { area, nameEl, livesEl, hand, actionEl };
    }
  }

  _updateOpponentArea(player) {
    const els = this._opponentElements[player.name];
    if (!els) return;

    const { area, nameEl, livesEl, hand } = els;

    area.className = 'player-area';
    if (player.isEliminated) area.classList.add('eliminated');
    if (this.engine.currentPlayer === player && this.engine.phase === 'playerTurn') {
      area.classList.add('active');
    }

    nameEl.className = 'player-name';
    if (player.knocked) nameEl.classList.add('knocked');
    nameEl.textContent = player.knocked ? `${player.name} (KNOCKED)` : player.name;

    livesEl.innerHTML = '';
    for (let i = 0; i < STARTING_LIVES; i++) {
      const token = document.createElement('div');
      token.className = 'life-token';
      if (i >= player.lives) token.classList.add('lost');
      livesEl.appendChild(token);
    }

    hand.innerHTML = '';
    const showFaceUp = this.engine.phase === 'roundEnd' || this.engine.phase === 'gameOver';
    for (const card of player.hand) {
      hand.appendChild(this._createCardElement(card, showFaceUp));
    }
  }

  _renderHumanArea() {
    const player = this.engine.players.find(p => p.isHuman);
    if (!player) return;

    const area = this.elements.humanArea;
    area.classList.toggle('active',
      this.engine.currentPlayer === player &&
      (this.engine.phase === 'playerTurn' || this.engine.phase === 'discarding')
    );

    this.elements.humanName.textContent = player.knocked ? 'You (KNOCKED)' : 'You';
    this.elements.humanName.classList.toggle('knocked', player.knocked);

    this.elements.humanLives.innerHTML = '';
    for (let i = 0; i < STARTING_LIVES; i++) {
      const token = document.createElement('div');
      token.className = 'life-token';
      if (i >= player.lives) token.classList.add('lost');
      this.elements.humanLives.appendChild(token);
    }

    this.elements.humanHand.innerHTML = '';
    const isDiscarding = this.engine.phase === 'discarding' && this.engine.currentPlayer === player;

    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      const cardEl = this._createCardElement(card, true);
      if (isDiscarding) {
        cardEl.classList.add('clickable');
        const idx = i;
        cardEl.addEventListener('click', () => {
          // Animate discard for human
          this._humanDiscard(idx);
        });
      }
      this.elements.humanHand.appendChild(cardEl);
    }
  }

  _humanDiscard(cardIndex) {
    if (this.engine.phase !== 'discarding') return;
    const player = this.engine.players.find(p => p.isHuman);
    if (!player) return;

    const card = player.hand[cardIndex];
    // Get position of the card in hand before removing
    const cardEls = this.elements.humanHand.querySelectorAll('.card');
    const sourceEl = cardEls[cardIndex];
    const discardEl = this.elements.discardPile.querySelector('.card') || this.elements.discardPile;

    if (sourceEl && discardEl) {
      const sourceRect = sourceEl.getBoundingClientRect();
      const destRect = discardEl.getBoundingClientRect();

      // Start flying card at source position
      const flyEl = this.elements.flyingCard;
      flyEl.innerHTML = '';
      flyEl.appendChild(this._createCardElement(card, true));
      flyEl.style.left = sourceRect.left + 'px';
      flyEl.style.top = sourceRect.top + 'px';
      flyEl.classList.remove('hidden');

      // Hide the source card
      sourceEl.style.visibility = 'hidden';

      // Animate to discard pile
      requestAnimationFrame(() => {
        flyEl.style.left = destRect.left + 'px';
        flyEl.style.top = destRect.top + 'px';

        setTimeout(() => {
          flyEl.classList.add('hidden');
          this.engine.discard(cardIndex);
        }, 370);
      });
    } else {
      this.engine.discard(cardIndex);
    }
  }

  _renderStockPile() {
    const pile = this.elements.stockPile;
    pile.innerHTML = '';

    if (this.engine.deck.remaining === 0) {
      pile.innerHTML = '<div class="card" style="opacity:0.2"><div class="card-inner"><div class="card-back"></div></div></div>';
      return;
    }

    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.innerHTML = '<div class="card-inner"><div class="card-back"></div></div>';

    const human = this.engine.players.find(p => p.isHuman);
    if (this.engine.phase === 'playerTurn' && this.engine.currentPlayer === human && !this.engine._animating) {
      cardEl.classList.add('clickable');
      cardEl.addEventListener('click', () => this._humanDrawFromStock());
    }

    pile.appendChild(cardEl);
  }

  _humanDrawFromStock() {
    if (this.engine.phase !== 'playerTurn' || this.engine._animating) return;

    const stockCard = this.elements.stockPile.querySelector('.card');
    if (!stockCard) return;

    const sourceRect = stockCard.getBoundingClientRect();

    // Draw the card (adds to hand)
    const card = this.engine.drawFromStock();
    if (!card) return;

    // If instant win triggered, skip animation
    if (this.engine.phase === 'roundEnd') return;

    // Re-render to show the new hand state, then animate
    this.render();

    // Find the newly added card (last in hand)
    const human = this.engine.players.find(p => p.isHuman);
    const handCards = this.elements.humanHand.querySelectorAll('.card');
    const targetEl = handCards[human.hand.length - 1];
    if (!targetEl) return;

    const destRect = targetEl.getBoundingClientRect();

    // Show flying card (face down from stock)
    const flyEl = this.elements.flyingCard;
    flyEl.innerHTML = '';
    flyEl.appendChild(this._createCardElement(card, false));
    flyEl.style.left = sourceRect.left + 'px';
    flyEl.style.top = sourceRect.top + 'px';
    flyEl.classList.remove('hidden');

    // Hide the target card temporarily
    targetEl.style.visibility = 'hidden';

    requestAnimationFrame(() => {
      flyEl.style.left = destRect.left + 'px';
      flyEl.style.top = destRect.top + 'px';

      setTimeout(() => {
        flyEl.classList.add('hidden');
        targetEl.style.visibility = '';
        this.render();
      }, 370);
    });
  }

  _humanDrawFromDiscard() {
    if (this.engine.phase !== 'playerTurn' || this.engine._animating) return;

    const discardCard = this.elements.discardPile.querySelector('.card');
    if (!discardCard) return;

    const sourceRect = discardCard.getBoundingClientRect();

    const card = this.engine.drawFromDiscard();
    if (!card) return;

    if (this.engine.phase === 'roundEnd') return;

    this.render();

    const human = this.engine.players.find(p => p.isHuman);
    const handCards = this.elements.humanHand.querySelectorAll('.card');
    const targetEl = handCards[human.hand.length - 1];
    if (!targetEl) return;

    const destRect = targetEl.getBoundingClientRect();

    const flyEl = this.elements.flyingCard;
    flyEl.innerHTML = '';
    flyEl.appendChild(this._createCardElement(card, true));
    flyEl.style.left = sourceRect.left + 'px';
    flyEl.style.top = sourceRect.top + 'px';
    flyEl.classList.remove('hidden');

    targetEl.style.visibility = 'hidden';

    requestAnimationFrame(() => {
      flyEl.style.left = destRect.left + 'px';
      flyEl.style.top = destRect.top + 'px';

      setTimeout(() => {
        flyEl.classList.add('hidden');
        targetEl.style.visibility = '';
        this.render();
      }, 370);
    });
  }

  _renderDiscardPile() {
    const pile = this.elements.discardPile;
    pile.innerHTML = '';

    const topCard = this.engine.discardTop;
    if (!topCard) {
      pile.innerHTML = '<div class="card" style="opacity:0.15"><div class="card-inner"><div class="card-front"></div></div></div>';
      return;
    }

    const cardEl = this._createCardElement(topCard, true);

    const human = this.engine.players.find(p => p.isHuman);
    if (this.engine.phase === 'playerTurn' && this.engine.currentPlayer === human && !this.engine._animating) {
      cardEl.classList.add('clickable');
      cardEl.addEventListener('click', () => this._humanDrawFromDiscard());
    }

    pile.appendChild(cardEl);
  }

  _updateKnockButton() {
    const human = this.engine.players.find(p => p.isHuman);
    const canKnock = this.engine.phase === 'playerTurn' &&
      this.engine.currentPlayer === human &&
      !this.engine.knocker &&
      !this.engine._animating;

    this.elements.knockBtn.disabled = !canKnock;
  }

  _updateKnockBanner() {
    const banner = this.elements.knockBanner;
    if (!this.engine.knocker) {
      banner.classList.add('hidden');
      return;
    }
    banner.classList.remove('hidden');
    const knockerName = this.engine.knocker.isHuman ? 'You' : this.engine.knocker.name;
    banner.innerHTML = `<span class="knock-icon">&#x1F44A;</span> ${knockerName} knocked! — Final round!`;
  }

  // ===== CARD ANIMATION =====
  animateCard(type, player, card, source, done) {
    const flyEl = this.elements.flyingCard;

    if (type === 'draw') {
      // Animate from pile to player's hand
      const pileEl = source === 'stock'
        ? this.elements.stockPile.querySelector('.card')
        : this.elements.discardPile.querySelector('.card');

      // Get the target hand element
      const handEl = player.isHuman
        ? this.elements.humanHand
        : (this._opponentElements[player.name]?.hand);

      if (!pileEl || !handEl) { done(); return; }

      const sourceRect = pileEl.getBoundingClientRect();
      const destRect = handEl.getBoundingClientRect();

      // Create the flying card (face down from stock, face up from discard)
      const faceUp = source === 'discard';
      flyEl.innerHTML = '';
      flyEl.appendChild(this._createCardElement(card, faceUp));
      flyEl.style.left = sourceRect.left + 'px';
      flyEl.style.top = sourceRect.top + 'px';
      flyEl.style.transition = 'none'; // reset
      flyEl.classList.remove('hidden');

      // Target: right edge of hand (where 4th card will appear)
      const targetLeft = destRect.right - (card ? 72 : 0); // approximate card width
      const targetTop = destRect.top;

      requestAnimationFrame(() => {
        flyEl.style.transition = 'left 0.35s ease-in-out, top 0.35s ease-in-out';
        flyEl.style.left = targetLeft + 'px';
        flyEl.style.top = targetTop + 'px';

        setTimeout(() => {
          flyEl.classList.add('hidden');
          done();
        }, 370);
      });

    } else if (type === 'discard') {
      // Animate from player's hand to discard pile
      const handEl = player.isHuman
        ? this.elements.humanHand
        : (this._opponentElements[player.name]?.hand);

      const discardEl = this.elements.discardPile;

      if (!handEl || !discardEl) { done(); return; }

      // The card was already removed from the hand by the engine, so we position
      // at the hand area center
      const sourceRect = handEl.getBoundingClientRect();
      const destRect = discardEl.getBoundingClientRect();

      flyEl.innerHTML = '';
      // For AI, show face up during discard so you can see what they discarded
      flyEl.appendChild(this._createCardElement(card, true));
      flyEl.style.left = (sourceRect.left + sourceRect.width / 2 - 36) + 'px';
      flyEl.style.top = sourceRect.top + 'px';
      flyEl.style.transition = 'none';
      flyEl.classList.remove('hidden');

      requestAnimationFrame(() => {
        flyEl.style.transition = 'left 0.35s ease-in-out, top 0.35s ease-in-out';
        flyEl.style.left = destRect.left + 'px';
        flyEl.style.top = destRect.top + 'px';

        setTimeout(() => {
          flyEl.classList.add('hidden');
          done();
        }, 370);
      });
    } else {
      done();
    }
  }

  // ===== PLAYER ACTIONS =====
  showPlayerAction(playerName, text, isKnock = false) {
    const els = this._opponentElements[playerName];
    if (!els) return;
    const { actionEl } = els;

    if (isKnock) {
      // Knock action persists until round end
      actionEl.textContent = text;
      actionEl.className = 'player-action knock-persistent';
      // Don't auto-clear — will be cleared by clearAllActions on next round
      return;
    }

    actionEl.textContent = text;
    actionEl.className = 'player-action visible';
    clearTimeout(actionEl._fadeTimer);
    actionEl._fadeTimer = setTimeout(() => {
      // Don't clear if it became a persistent knock indicator
      if (!actionEl.classList.contains('knock-persistent')) {
        actionEl.classList.remove('visible');
      }
    }, 2500);
  }

  clearAllActions() {
    for (const els of Object.values(this._opponentElements)) {
      els.actionEl.className = 'player-action';
      els.actionEl.textContent = '';
    }
  }

  // ===== CARD ELEMENT =====
  _createCardElement(card, faceUp) {
    const el = document.createElement('div');
    el.className = 'card';
    if (faceUp) el.classList.add('flipped');

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    // Front
    const front = document.createElement('div');
    front.className = `card-front ${card.color}`;

    const cornerTL = document.createElement('div');
    cornerTL.className = 'card-corner top-left';
    cornerTL.innerHTML = `${card.rank}<br>${card.symbol}`;
    front.appendChild(cornerTL);

    const rank = document.createElement('div');
    rank.className = 'card-rank';
    rank.textContent = card.rank;
    front.appendChild(rank);

    const suit = document.createElement('div');
    suit.className = 'card-suit';
    suit.textContent = card.symbol;
    front.appendChild(suit);

    const cornerBR = document.createElement('div');
    cornerBR.className = 'card-corner bottom-right';
    cornerBR.innerHTML = `${card.rank}<br>${card.symbol}`;
    front.appendChild(cornerBR);

    // Back
    const back = document.createElement('div');
    back.className = 'card-back';

    inner.appendChild(front);
    inner.appendChild(back);
    el.appendChild(inner);

    return el;
  }

  // ===== MESSAGES =====
  showMessage(text, type = '') {
    this.elements.messageBar.textContent = text;
    this.elements.messageBar.className = 'message-bar';
    if (type) this.elements.messageBar.classList.add(type);
  }

  // ===== ROUND RESULTS =====
  showRoundResults({ results, losers, lowestScore }) {
    this.elements.roundResultTitle.textContent = `Round ${this.engine.roundNumber} Results`;
    this.elements.roundResultsList.innerHTML = '';

    results.sort((a, b) => b.score - a.score);

    for (const r of results) {
      const li = document.createElement('li');
      const isLoser = losers.includes(r.player);
      li.className = isLoser ? 'loser' : (r === results[0] ? 'winner' : '');

      const nameSpan = document.createElement('span');
      nameSpan.textContent = r.player.name + (isLoser ? ' (-1 life)' : '');
      li.appendChild(nameSpan);

      const handDiv = document.createElement('div');
      handDiv.className = 'result-hand';
      for (const card of r.player.hand) {
        const cardSpan = document.createElement('span');
        cardSpan.className = `result-card ${card.color}`;
        cardSpan.textContent = card.toString();
        handDiv.appendChild(cardSpan);
      }
      li.appendChild(handDiv);

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'result-score';
      scoreSpan.textContent = r.score;
      li.appendChild(scoreSpan);

      this.elements.roundResultsList.appendChild(li);
    }

    this.elements.roundOverlay.classList.remove('hidden');
  }

  showInstantWin({ winner, results }) {
    this.showMessage(`${winner.name} has 31! INSTANT WIN!`, 'instant-win');

    this.render();

    setTimeout(() => {
      this.elements.roundResultTitle.textContent = `INSTANT WIN - ${winner.name}!`;
      this.elements.roundResultsList.innerHTML = '';

      for (const r of results) {
        const li = document.createElement('li');
        li.className = r.player === winner ? 'winner' : 'loser';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = r.player.name + (r.player !== winner ? ' (-1 life)' : '');
        li.appendChild(nameSpan);

        const handDiv = document.createElement('div');
        handDiv.className = 'result-hand';
        for (const card of r.player.hand) {
          const cardSpan = document.createElement('span');
          cardSpan.className = `result-card ${card.color}`;
          cardSpan.textContent = card.toString();
          handDiv.appendChild(cardSpan);
        }
        li.appendChild(handDiv);

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'result-score';
        scoreSpan.textContent = r.score;
        li.appendChild(scoreSpan);

        this.elements.roundResultsList.appendChild(li);
      }

      this.elements.roundOverlay.classList.remove('hidden');
    }, 1500);
  }

  // ===== GAME OVER =====
  showGameOver(winner) {
    const human = this.engine.players.find(p => p.isHuman);
    if (winner === human) {
      this.elements.gameoverTitle.textContent = 'YOU WIN!';
    } else {
      this.elements.gameoverTitle.textContent = 'GAME OVER';
    }
    this.elements.gameoverWinner.textContent = winner ? winner.name : 'No one';
    this.elements.gameoverOverlay.classList.remove('hidden');
  }
}
