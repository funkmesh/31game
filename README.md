# 31 - Card Game

A browser-based version of the classic card game 31 (also known as Scat or Blitz). Play against 1-3 AI opponents with configurable difficulty.

**[Play now](https://funkmesh.github.io/31game/)**

## Rules

- Each player is dealt 3 cards from a standard 52-card deck
- Card values: Ace = 11, Face cards = 10, Number cards = face value
- Your score is the sum of cards in your **best single suit**
- On your turn: draw from the stock pile or discard pile, then discard one card
- **Knock** instead of drawing to signal the final round — everyone else gets one more turn
- **Instant win**: Ace + Face card (J/Q/K) + 10, all same suit — everyone else loses a life immediately
- Lowest score each round loses a life (ties: all tied losers lose a life)
- 3 lives per player — last one standing wins

## AI Difficulty

- **Easy** — Cautious knocking (29+), occasionally makes suboptimal discards
- **Medium** — Balanced play, knocks at 27+
- **Hard** — Aggressive knocking (25+), evaluates all possible discards for optimal play

## Tech

Vanilla HTML/CSS/JavaScript with ES modules. No dependencies, no build step.

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000
