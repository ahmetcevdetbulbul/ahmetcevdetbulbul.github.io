"""A small alpha-beta chess engine that reports its thinking as it goes.

`think()` is a generator: each `yield` hands back a snapshot of the search
state (current depth, node count, root move scores, best line so far) so a
UI can render the engine "thinking" in real time instead of just getting a
final answer.
"""

import chess

from evaluation import evaluate

MATE_SCORE = 99999


class SearchInfo:
    """Mutable snapshot of search progress, updated in place and yielded."""

    def __init__(self):
        self.depth = 0
        self.nodes = 0
        self.root_scores = {}  # move -> score (centipawns, side-to-move POV)
        self.best_move = None
        self.best_score = 0
        self.pv = []  # principal variation, list of moves
        self.current_move = None  # root move currently being explored
        self.done = False

    def snapshot(self):
        return {
            "depth": self.depth,
            "nodes": self.nodes,
            "root_scores": dict(self.root_scores),
            "best_move": self.best_move,
            "best_score": self.best_score,
            "pv": list(self.pv),
            "current_move": self.current_move,
            "done": self.done,
        }


class Engine:
    def __init__(self, max_depth: int = 3):
        self.max_depth = max_depth

    def think(self, board: chess.Board, max_depth: int | None = None):
        """Iterative-deepening alpha-beta search. Yields SearchInfo snapshots."""
        depth_limit = max_depth or self.max_depth
        info = SearchInfo()

        for depth in range(1, depth_limit + 1):
            info.depth = depth
            info.root_scores = {}
            best_move = None
            best_score = -MATE_SCORE - 1
            alpha, beta = -MATE_SCORE - 1, MATE_SCORE + 1

            best_line = []
            legal_moves = self._order_moves(board, list(board.legal_moves))
            for move in legal_moves:
                info.current_move = move
                yield info.snapshot()

                board.push(move)
                score, line = self._negamax(board, depth - 1, -beta, -alpha, info)
                score = -score
                board.pop()

                info.root_scores[move] = score
                if score > best_score:
                    best_score = score
                    best_move = move
                    best_line = [move] + line
                alpha = max(alpha, best_score)

                yield info.snapshot()

            info.best_move = best_move
            info.best_score = best_score
            info.pv = best_line
            yield info.snapshot()

        info.done = True
        yield info.snapshot()

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

    def _order_moves(self, board, moves):
        # Cheap move ordering: captures first (helps alpha-beta prune more).
        def score(move):
            return 1 if board.is_capture(move) else 0

        return sorted(moves, key=score, reverse=True)

