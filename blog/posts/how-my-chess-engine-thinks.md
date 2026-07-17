## Abstract

Most chess engines are black boxes: you give them a position, they give you a move, and the
reasoning in between is invisible. For **Ches Engine**, a small Python project built on top of
[python-chess](https://python-chess.readthedocs.io/) and `pygame`, I wanted the
opposite — a board you can play against, with a side panel that shows the search happening live:
which move the engine is currently considering, what score it found for each candidate, and the
best line it expects both sides to play.

This post walks through the whole thing end to end: how the board is represented, the game-tree
search that decides "best" moves, the math behind minimax and alpha-beta pruning (with real
benchmark numbers from running the engine, not textbook estimates), the evaluation function that
scores a position, and the generator-based design that makes the search observable instead of a
single opaque function call.

<div class="callout callout-tip">
<div class="callout-title">🎯 What you'll get out of this</div>
A working mental model of how a depth-limited alpha-beta chess engine actually searches a position
— grounded in the exact code and the exact numbers this engine produces, not a simplified toy
example.
</div>

## 1. Representing the board

The engine doesn't implement chess rules itself — `python-chess` handles legality, check
detection, castling rights, en passant, and move generation. A position is a `chess.Board`, and
`board.legal_moves` yields every legal move from that position. This matters more than it sounds:
correct move generation is one of the easiest places for a hand-rolled chess engine to go subtly
wrong (missing en passant, pinned-piece rules, castling-through-check), and getting it from a
well-tested library means the search and evaluation code can be trusted to only ever see legal
positions.

```python
import chess

board = chess.Board()          # standard starting position
for move in board.legal_moves: # e.g. Nf3, e4, d4, ...
    print(move.uci())
```

Internally, a `chess.Board` is closer to a set of bitboards than a naive 8×8 array — each piece
type and color is a 64-bit integer where each bit marks occupancy of one square. That's what makes
`legal_moves` fast enough to call millions of times during a search, which is exactly what a
depth-4 or depth-5 search does.

## 2. The problem search is solving

Chess is a **zero-sum, perfect-information game**: nothing is hidden, and one side's gain is the
other's loss. That structure is what makes it tractable to reason about with a game tree — a tree
where the root is the current position, each edge is a legal move, and each node is the resulting
position.

If you could build the *entire* game tree down to checkmate, choosing the best move would just be
a matter of walking it. You can't — chess has roughly $10^{120}$ possible games (the
[Shannon number](https://en.wikipedia.org/wiki/Shannon_number)) — so every practical engine,
including this one, does two things instead:

1. **Searches only a few moves deep** (a fixed *ply* horizon), instead of to the end of the game.
2. **Estimates** how good the resulting positions are with a static evaluation function, instead
   of knowing for certain who wins.

Everything below is about how to make that depth-limited estimate as good as possible, as fast as
possible.

## 3. Minimax: the core idea

Chess alternates turns, and both players are assumed to play optimally for themselves. That gives
a very clean recursive definition of a position's value:

$$
\text{minimax}(n) =
\begin{cases}
\text{eval}(n) & \text{if } n \text{ is a leaf (search horizon)} \\\\[4pt]
\max\big(\text{minimax}(c) : c \in \text{children}(n)\big) & \text{if White to move at } n \\\\[4pt]
\min\big(\text{minimax}(c) : c \in \text{children}(n)\big) & \text{if Black to move at } n
\end{cases}
$$

White picks the child with the *highest* backed-up value, Black picks the child with the *lowest*
one — Black is trying to minimize White's score, which is exactly what an adversary does. Here's a
tiny two-ply example with made-up leaf scores (positive favors White):

<div class="chart-card">
<h4>A minimax search, two plies deep</h4>
<img src="assets/chess-engine/minimax_tree.svg" alt="A two-ply minimax game tree. Root is a MAX node with value 3, backed up from a MIN node that chose the smaller of its two children (+3 and +5).">
<p class="chart-caption">The MIN node on the left picks the smaller of its two children (+3, not
+5) because that's worse for White. The MAX node at the root then picks the larger of its two
children's backed-up values (3, not −2). The value 3 propagates all the way up from a leaf four
levels below it, chosen purely by alternating max/min at each level.</p>
</div>

Notice the value **3** at the root didn't come from evaluating the root position directly — it's
the static evaluation of a leaf, filtered up through two rounds of best-for-whoever's-moving
selection. That's the entire idea of minimax: push a cheap, potentially wrong per-leaf estimate up
through the tree, and let the alternating max/min structure turn it into a move recommendation
that accounts for the opponent's best response.

### Negamax: the same idea, half the code

Writing separate max-branch and min-branch code is redundant — this codebase uses the standard
**negamax** simplification instead, which exploits the fact that
$\max(a, b) = -\min(-a, -b)$. Every node just negates and maximizes:

$$
\text{negamax}(n, \text{color}) =
\begin{cases}
\text{color} \times \text{eval}(n) & \text{depth} = 0 \\\\[4pt]
\max\big(-\text{negamax}(c, -\text{color}) : c \in \text{children}(n)\big) & \text{otherwise}
\end{cases}
$$

where `color` is $+1$ if White is to move and $-1$ if Black is to move. This is the actual
recursive core of the engine, from [engine.py](assets/chess-engine/engine.py):

```python
def _negamax(self, board, depth, alpha, beta, info):
    """Returns (score, line) where line is the best continuation found."""
    info.nodes += 1

    if board.is_checkmate():
        return -MATE_SCORE, []
    if board.is_stalemate() or board.is_insufficient_material():
        return 0, []
    if depth == 0:
        sign = 1 if board.turn == chess.WHITE else -1
        return sign * evaluate(board), []

    best = -MATE_SCORE - 1
    best_line = []
    for move in self._order_moves(board, list(board.legal_moves)):
        board.push(move)
        score, line = self._negamax(board, depth - 1, -beta, -alpha, info)
        score = -score
        board.pop()

        if score > best:
            best = score
            best_line = [move] + line
        alpha = max(alpha, score)
        if alpha >= beta:
            break  # alpha-beta cutoff
    return best, best_line
```

Every recursive call flips the sign convention (`-beta, -alpha`) and negates the returned score
(`score = -score`), so the function never needs to know or care whose turn it is beyond that one
sign flip — `evaluate()` always returns a score from White's perspective, and negamax re-orients
it to "the side to move's" perspective at every level.

## 4. Alpha-beta pruning: doing less work for the same answer

A plain minimax search examines *every* node in the tree. Most of that work is wasted — if you've
already found a move that guarantees Black a good-enough outcome, you don't need to know exactly
*how* bad an even worse sibling move is, only that it's worse. **Alpha-beta pruning** formalizes
that intuition with two bounds carried through the recursion:

- $\alpha$ — the best score the maximizing side can already guarantee somewhere else in the tree.
- $\beta$ — the best score the minimizing side can already guarantee somewhere else in the tree.

Once $\alpha \ge \beta$ at a node, that node cannot possibly change the final decision — any
further children can only make the current player's outcome *look* better, but the other side will
simply never route the game through this node in the first place, because they have a
provably-better option elsewhere in the tree. So the search stops exploring right there:

<div class="chart-card">
<h4>The same tree, with one branch pruned</h4>
<img src="assets/chess-engine/alphabeta_tree.svg" alt="Same game tree as before, but the fourth leaf is never evaluated because the MIN node it belongs to is already guaranteed to be worse than the alpha bound established by the first branch.">
<p class="chart-caption">After exploring node A, White has a guaranteed score of 3 (α = 3). While exploring node B, Black
immediately finds a reply worth −2 — already below α. Black is minimizing, so B's remaining
children can only pull B's value down further, never back above −2. White would never route the
game through a node worth ≤ −2 when node A already guarantees 3. So B's second child is never
evaluated — same final answer, one fewer leaf visited.</p>
</div>

This is a pure optimization: **alpha-beta produces exactly the same move as plain minimax**, it
just avoids visiting parts of the tree that provably can't affect the outcome. Move ordering
matters a lot here — the earlier a strong move is tried, the tighter $\alpha$ and $\beta$ become,
and the more later branches get cut. This engine does one cheap ordering trick before scanning a
node's children:

```python
def _order_moves(self, board, moves):
    # Cheap move ordering: captures first (helps alpha-beta prune more).
    def score(move):
        return 1 if board.is_capture(move) else 0

    return sorted(moves, key=score, reverse=True)
```

Trying captures first is a well-known heuristic: captures tend to swing the evaluation the most,
so they're likely to establish a tight bound early, which is exactly what pruning needs.

### How much does it actually save?

Rather than quote the textbook complexity bound, I benchmarked the real engine from the starting
position at increasing depths, and compared it against a full, unpruned minimax traversal of the
exact same tree:

<div class="chart-card">
<h4>Nodes visited: full minimax vs. alpha-beta (log scale)</h4>
<img src="assets/chess-engine/growth_chart.svg" alt="Line chart comparing node counts for unpruned minimax versus alpha-beta pruning across search depths 1 through 5, log scale.">
<p class="chart-caption">Measured directly from this codebase, not simulated. At depth 5, plain
minimax visits 5,072,213 nodes; alpha-beta (with capture-first move ordering) visits only 40,114 —
a <strong>126×</strong> reduction, and the gap widens every additional ply.</p>
</div>

<table>
<thead><tr><th>Depth (plies)</th><th>Unpruned minimax</th><th>Alpha-beta pruned</th><th>Reduction</th></tr></thead>
<tbody>
<tr><td>1</td><td>21</td><td>20</td><td>1.05×</td></tr>
<tr><td>2</td><td>421</td><td>103</td><td>4.1×</td></tr>
<tr><td>3</td><td>9,323</td><td>879</td><td>10.6×</td></tr>
<tr><td>4</td><td>206,604</td><td>3,987</td><td>51.8×</td></tr>
<tr><td>5</td><td>5,072,213</td><td>40,114</td><td>126.5×</td></tr>
</tbody>
</table>

This lines up with the theoretical bound: plain minimax is $O(b^d)$ for branching factor $b$ and
depth $d$, while alpha-beta with good move ordering approaches $O(b^{d/2})$ — effectively letting
you search **twice as deep** for the same amount of work. The measured reduction factor
accelerates with depth precisely because $b^{d/2}$ pulls away from $b^d$ faster as $d$ grows —
exactly what the chart shows.

## 5. The evaluation function: turning a position into a number

At the search horizon (`depth == 0`), the engine needs a number: how good is this position for
White, in *centipawns* (hundredths of a pawn — the standard chess-engine unit, so "+100" means
"White is up about one pawn's worth of advantage"). This engine's evaluation, in
[evaluation.py](assets/chess-engine/evaluation.py), has two components:

$$
\text{eval}(\text{board}) = \sum\_{p \, \in \, \text{pieces}} \text{color}(p) \times \big(\text{material}(p) + \text{pst}(p, \text{square})\big)
$$

**Material** is the classic relative piece values, calibrated in "pawns" — the standard values
chess players and engines alike converge on:

<div class="chart-card">
<h4>Material values used by the evaluation function</h4>
<img src="assets/chess-engine/material_chart.svg" alt="Bar chart of piece values in centipawns: pawn 100, knight 320, bishop 330, rook 500, queen 900.">
<p class="chart-caption">The king isn't included — it's never captured, so it has no material
value in this scheme; king safety is a separate (and, in this first version, unimplemented)
concern.</p>
</div>

**Piece-square tables** (PSTs) adjust that base value by *where* the piece stands. A knight on the
rim is proverbially dim — it controls far fewer squares than a centralized knight — so the
evaluation should reward central knights and penalize edge/corner ones, even though a knight is a
knight is a knight materially. Here's the actual table used for knights, visualized as a heatmap
over the 8×8 board (green = bonus, red = penalty):

<div class="chart-card">
<h4>Knight piece-square table (centipawns, White's perspective, rank 8 at top)</h4>
<div class="heatmap">
  <div class="cell" style="background:rgba(239,68,68,0.70)">-50</div>
  <div class="cell" style="background:rgba(239,68,68,0.59)">-40</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.59)">-40</div>
  <div class="cell" style="background:rgba(239,68,68,0.70)">-50</div>
  <div class="cell" style="background:rgba(239,68,68,0.59)">-40</div>
  <div class="cell" style="background:rgba(239,68,68,0.37)">-20</div>
  <div class="cell" style="background:rgba(34,197,94,0.15)">+0</div>
  <div class="cell" style="background:rgba(34,197,94,0.15)">+0</div>
  <div class="cell" style="background:rgba(34,197,94,0.15)">+0</div>
  <div class="cell" style="background:rgba(34,197,94,0.15)">+0</div>
  <div class="cell" style="background:rgba(239,68,68,0.37)">-20</div>
  <div class="cell" style="background:rgba(239,68,68,0.59)">-40</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(34,197,94,0.15)">+0</div>
  <div class="cell" style="background:rgba(34,197,94,0.47)">+10</div>
  <div class="cell" style="background:rgba(34,197,94,0.64)">+15</div>
  <div class="cell" style="background:rgba(34,197,94,0.64)">+15</div>
  <div class="cell" style="background:rgba(34,197,94,0.47)">+10</div>
  <div class="cell" style="background:rgba(34,197,94,0.15)">+0</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(34,197,94,0.31)">+5</div>
  <div class="cell" style="background:rgba(34,197,94,0.64)">+15</div>
  <div class="cell" style="background:rgba(34,197,94,0.80)">+20</div>
  <div class="cell" style="background:rgba(34,197,94,0.80)">+20</div>
  <div class="cell" style="background:rgba(34,197,94,0.64)">+15</div>
  <div class="cell" style="background:rgba(34,197,94,0.31)">+5</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(34,197,94,0.15)">+0</div>
  <div class="cell" style="background:rgba(34,197,94,0.64)">+15</div>
  <div class="cell" style="background:rgba(34,197,94,0.80)">+20</div>
  <div class="cell" style="background:rgba(34,197,94,0.80)">+20</div>
  <div class="cell" style="background:rgba(34,197,94,0.64)">+15</div>
  <div class="cell" style="background:rgba(34,197,94,0.15)">+0</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(34,197,94,0.31)">+5</div>
  <div class="cell" style="background:rgba(34,197,94,0.47)">+10</div>
  <div class="cell" style="background:rgba(34,197,94,0.64)">+15</div>
  <div class="cell" style="background:rgba(34,197,94,0.64)">+15</div>
  <div class="cell" style="background:rgba(34,197,94,0.47)">+10</div>
  <div class="cell" style="background:rgba(34,197,94,0.31)">+5</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.59)">-40</div>
  <div class="cell" style="background:rgba(239,68,68,0.37)">-20</div>
  <div class="cell" style="background:rgba(34,197,94,0.15)">+0</div>
  <div class="cell" style="background:rgba(34,197,94,0.31)">+5</div>
  <div class="cell" style="background:rgba(34,197,94,0.31)">+5</div>
  <div class="cell" style="background:rgba(34,197,94,0.15)">+0</div>
  <div class="cell" style="background:rgba(239,68,68,0.37)">-20</div>
  <div class="cell" style="background:rgba(239,68,68,0.59)">-40</div>
  <div class="cell" style="background:rgba(239,68,68,0.70)">-50</div>
  <div class="cell" style="background:rgba(239,68,68,0.59)">-40</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.48)">-30</div>
  <div class="cell" style="background:rgba(239,68,68,0.59)">-40</div>
  <div class="cell" style="background:rgba(239,68,68,0.70)">-50</div>
</div>
<p class="chart-caption">The four central squares (d4, e4, d5, e5) are worth +20; a1/h1/a8/h8
corners cost −50. Rooks, bishops, and queens each get their own table with the same idea — reward
squares consistent with how that piece actually contributes.</p>
</div>

Every piece type has its own table (pawns are pushed toward promotion, kings are kept safe in the
corner during the middlegame), and material dominates the score — a 300-point piece advantage
easily outweighs any positional bonus — which is the intended priority order: don't lose material
for positional nuance the search can't fully justify at shallow depth.

## 6. Making the search observable

The interesting engineering problem in this project wasn't the search itself — minimax and
alpha-beta are textbook algorithms — it was making that search **visible** without turning it into
a slow, chatty mess. The solution is a Python generator. Instead of `think()` returning a single
move once it's done, it `yield`s a snapshot of its progress at meaningful points: before exploring
each root move, after finishing it, and after completing each iterative-deepening depth:

```python
def think(self, board: chess.Board, max_depth: int | None = None):
    """Iterative-deepening alpha-beta search. Yields SearchInfo snapshots."""
    depth_limit = max_depth or self.max_depth
    info = SearchInfo()

    for depth in range(1, depth_limit + 1):
        info.depth = depth
        best_move = None
        best_score = -MATE_SCORE - 1
        alpha, beta = -MATE_SCORE - 1, MATE_SCORE + 1
        best_line = []

        for move in self._order_moves(board, list(board.legal_moves)):
            info.current_move = move
            yield info.snapshot()          # "I'm about to look at this move"

            board.push(move)
            score, line = self._negamax(board, depth - 1, -beta, -alpha, info)
            score = -score
            board.pop()

            info.root_scores[move] = score
            if score > best_score:
                best_score, best_move, best_line = score, move, [move] + line
            alpha = max(alpha, best_score)

            yield info.snapshot()          # "Here's what I found"

        info.best_move, info.best_score, info.pv = best_move, best_score, best_line
        yield info.snapshot()              # "Depth complete, here's the current best line"
```

The GUI's game loop pulls a handful of these snapshots per frame (`next(self.thinking_gen)`
inside `step_engine()`), so the search runs to completion in well under a second at depth 3, but
the side panel still gets several real update points to render — current move being explored,
a live-updating ranked list of candidate moves and their scores, and the principal variation (the
sequence of best moves both sides are expected to play) reconstructed from the actual recursion,
not approximated afterward.

<figure>
<img src="assets/chess-engine/board-startpos.png" alt="Screenshot of the Ches Engine pygame window at the starting position, showing the board on the left and an empty 'Engine thinking' panel on the right before White's first move.">
<figcaption>The actual running application — board on the left, live search panel on the right.
Clicking a piece then a destination square makes a move; the engine responds as Black.</figcaption>
</figure>

## 7. A worked example

Running the search headlessly from the starting position at depth 3 (no GUI, just the generator
driven to completion) produces this:

```text
best move: g1f3
best score: 50
nodes: 879
pv: ['g1f3', 'g8f6', 'b1c3']
```

In words: the engine's top choice is **Nf3**, developing the king's knight toward the center. It
evaluated the position as +50 centipawns for White (half a pawn's worth of advantage — consistent
with the small, well-known edge White gets from moving first). Its expected continuation
(the principal variation) is **1. Nf3 Nf6 2. Nc3** — both sides developing knights toward the
center, which is exactly the kind of sound, unremarkable opening play you'd want a 3-ply search
with this evaluation function to recommend. It visited 879 nodes to reach that conclusion — out of
9,323 a full, unpruned search of the same tree would have required.

<div class="callout callout-code">
<div class="callout-title">💻 Try it yourself</div>

```python
import chess
from engine import Engine

board = chess.Board()
engine = Engine(max_depth=3)

last = None
for info in engine.think(board):
    last = info   # drive the generator to completion

print("best move:", last["best_move"])
print("nodes:", last["nodes"])
print("pv:", [m.uci() for m in last["pv"]])
```
</div>

## 8. What this version doesn't do (yet)

This is a first, deliberately simple version, and being upfront about its limits matters more than
padding the feature list:

- **No quiescence search** — the engine stops dead at the depth horizon even in the middle of a
  capture sequence, which can produce a misleadingly good or bad score right before a piece is
  about to be recaptured (the classic "horizon effect").
- **No transposition table** — different move orders that reach the same position are searched
  from scratch every time, even though the search already solved that exact position moments ago.
- **No opening book or endgame tablebase** — every move, including the first one, is computed from
  first principles.
- **Fixed depth, not time-based** — a real tournament engine budgets a time limit per move and
  searches as deep as it can within it; this one always searches to a fixed ply count.

Each of those is a well-understood, incremental addition rather than a redesign — the generator-
based search architecture and the negamax/alpha-beta core are the right foundation to build them
on top of.

## References

- Russell, S. & Norvig, P. — *Artificial Intelligence: A Modern Approach*, chapter on adversarial
  search (minimax and alpha-beta pruning).
- Knuth, D. & Moore, R. — ["An Analysis of Alpha-Beta Pruning"](https://www.cs.cornell.edu/courses/cs312/2002sp/lectures/rec21.htm), 1975 — the original complexity analysis behind the
  $O(b^{d/2})$ bound cited above.
- [Chess Programming Wiki](https://www.chessprogramming.org/) — the de facto reference for
  piece-square tables, move ordering heuristics, and everything past this engine's current scope.
- [python-chess documentation](https://python-chess.readthedocs.io/) — the move generation and
  board representation library this engine is built on.
