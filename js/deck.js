import { SUITS, RANKS, CARD_VALUES, SUIT_SYMBOLS, SUIT_COLORS } from './constants.js';

export class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.value = CARD_VALUES[rank];
    this.id = `${suit}-${rank}`;
    this.symbol = SUIT_SYMBOLS[suit];
    this.color = SUIT_COLORS[suit];
  }

  toString() {
    return `${this.rank}${this.symbol}`;
  }
}

export class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(suit, rank));
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    return this.cards.pop() || null;
  }

  get remaining() {
    return this.cards.length;
  }

  addCards(cards) {
    this.cards.push(...cards);
  }
}
