import { evaluateHand, isInstantWin } from './scorer.js';
import { STARTING_LIVES } from './constants.js';

export class Player {
  constructor(name, isHuman = false) {
    this.name = name;
    this.isHuman = isHuman;
    this.hand = [];
    this.lives = STARTING_LIVES;
    this.knocked = false;
  }

  get isEliminated() {
    return this.lives <= 0;
  }

  receiveCards(cards) {
    this.hand = cards;
  }

  addCard(card) {
    this.hand.push(card);
  }

  removeCard(index) {
    return this.hand.splice(index, 1)[0];
  }

  getHandScore() {
    return evaluateHand(this.hand);
  }

  hasInstantWin() {
    return isInstantWin(this.hand);
  }

  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
  }

  resetForRound() {
    this.hand = [];
    this.knocked = false;
  }
}
