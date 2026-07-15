"""Strategy script engine — a small thinkScript-inspired expression language.

Compiles rule text like::

    close crosses above Highest(close, 20) and volume > 1.5 * SMA(volume, 50)

into a callable that maps an OHLCV DataFrame (price-cache column convention:
Open/High/Low/Close/Volume) to a boolean signal Series aligned to the frame.

Grammar (keywords, functions, and series names are case-insensitive)::

    expr        := or_expr
    or_expr     := and_expr ( OR and_expr )*
    and_expr    := not_expr ( AND not_expr )*
    not_expr    := NOT not_expr | comparison
    comparison  := additive ( (> | >= | < | <= | == | !=) additive
                             | CROSSES ABOVE additive
                             | CROSSES BELOW additive )?
    additive    := term ( (+ | -) term )*
    term        := unary ( (* | /) unary )*
    unary       := - unary | atom
    atom        := NUMBER | SERIES | FUNC '(' expr (',' expr)* ')' | '(' expr ')'

No Python ``eval`` is involved: the source is tokenized, parsed into an AST,
statically type-checked (the top level must be a true/false signal), and
evaluated with vectorized pandas operations.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

__all__ = ["ScriptError", "CompiledScript", "compile_script"]


class ScriptError(ValueError):
    """Raised for any tokenize/parse/type/evaluation problem in a script."""


SERIES_NAMES = ("open", "high", "low", "close", "volume")

_KEYWORDS = ("and", "or", "not", "crosses", "above", "below")

_TOKEN_RE = re.compile(
    r"\s*(?:"
    r"(?P<number>\d+\.\d*|\.\d+|\d+)"
    r"|(?P<name>[A-Za-z_][A-Za-z_0-9]*)"
    r"|(?P<op>>=|<=|==|!=|>|<|\+|-|\*|/|\(|\)|,)"
    r")"
)


@dataclass(frozen=True)
class _Token:
    kind: str  # number | name | op
    value: str


def _tokenize(source: str) -> list[_Token]:
    tokens: list[_Token] = []
    pos = 0
    while pos < len(source):
        match = _TOKEN_RE.match(source, pos)
        if match is None or match.end() == pos:
            remainder = source[pos:].strip()
            if not remainder:
                break
            raise ScriptError(f"Unexpected character at: {remainder[:20]!r}")
        pos = match.end()
        if match.group("number") is not None:
            tokens.append(_Token("number", match.group("number")))
        elif match.group("name") is not None:
            tokens.append(_Token("name", match.group("name")))
        else:
            tokens.append(_Token("op", match.group("op")))
    return tokens


# ---------------------------------------------------------------------------
# AST
# ---------------------------------------------------------------------------

# Node types carry a static result kind: "num" or "bool".


@dataclass(frozen=True)
class _Node:
    kind: str  # num | bool
    eval: Callable[[pd.DataFrame], object]


def _series_lower(df: pd.DataFrame, name: str) -> pd.Series:
    column = name.capitalize()  # open -> Open, volume -> Volume
    if column not in df.columns:
        raise ScriptError(f"Data is missing the {column} column")
    return df[column].astype(float)


# --- indicator functions ---------------------------------------------------


def _fn_sma(x: pd.Series, n: int) -> pd.Series:
    return x.rolling(n).mean()


def _fn_ema(x: pd.Series, n: int) -> pd.Series:
    return x.ewm(span=n, adjust=False).mean()


def _fn_highest(x: pd.Series, n: int) -> pd.Series:
    # Highest of the *previous* n bars, so "close > Highest(close, 20)"
    # naturally reads as "a new high versus what came before".
    return x.shift(1).rolling(n, min_periods=1).max()


def _fn_lowest(x: pd.Series, n: int) -> pd.Series:
    return x.shift(1).rolling(n, min_periods=1).min()


def _fn_rsi(df: pd.DataFrame, n: int) -> pd.Series:
    close = _series_lower(df, "close")
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1.0 / n, adjust=False, min_periods=n).mean()
    avg_loss = loss.ewm(alpha=1.0 / n, adjust=False, min_periods=n).mean()
    rsi = 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
    # Flat losses mean pure strength: define RSI = 100 (0 when no gains).
    rsi = rsi.where(avg_loss != 0, 100.0)
    rsi = rsi.where(avg_gain != 0, rsi.where(avg_loss == 0, 0.0))
    return rsi.where(~(avg_gain.isna() | avg_loss.isna()))


def _fn_atr(df: pd.DataFrame, n: int) -> pd.Series:
    high = _series_lower(df, "high")
    low = _series_lower(df, "low")
    close = _series_lower(df, "close")
    prev_close = close.shift(1)
    true_range = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1, skipna=True)
    return true_range.rolling(n, min_periods=1).mean()


# name -> (series_arg_count, window_arg, implementation)
_SERIES_FUNCS = {
    "sma": _fn_sma,
    "ema": _fn_ema,
    "highest": _fn_highest,
    "lowest": _fn_lowest,
}
_FRAME_FUNCS = {
    "rsi": _fn_rsi,
    "atr": _fn_atr,
}


def _require_window(node: _Node, fn_name: str) -> int:
    value = node.eval(pd.DataFrame({c: [] for c in ("Open", "High", "Low", "Close", "Volume")}))
    if not isinstance(value, (int, float)) or float(value) != int(value) or int(value) < 1:
        raise ScriptError(f"{fn_name} needs a whole-number period of at least 1")
    return int(value)


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------


class _Parser:
    def __init__(self, tokens: list[_Token]):
        self._tokens = tokens
        self._pos = 0

    # -- token helpers ------------------------------------------------------

    def _peek(self) -> _Token | None:
        return self._tokens[self._pos] if self._pos < len(self._tokens) else None

    def _next(self) -> _Token:
        token = self._peek()
        if token is None:
            raise ScriptError("Script ended unexpectedly")
        self._pos += 1
        return token

    def _peek_keyword(self) -> str | None:
        token = self._peek()
        if token is not None and token.kind == "name" and token.value.lower() in _KEYWORDS:
            return token.value.lower()
        return None

    def _expect_op(self, op: str) -> None:
        token = self._peek()
        if token is None or token.kind != "op" or token.value != op:
            found = token.value if token else "end of script"
            raise ScriptError(f"Expected '{op}' but found '{found}'")
        self._pos += 1

    # -- grammar -------------------------------------------------------------

    def parse(self) -> _Node:
        node = self._or_expr()
        if self._peek() is not None:
            raise ScriptError(f"Unexpected trailing input: '{self._peek().value}'")
        return node

    def _or_expr(self) -> _Node:
        node = self._and_expr()
        while self._peek_keyword() == "or":
            self._next()
            right = self._and_expr()
            node = self._bool_op(node, right, np.logical_or, "or")
        return node

    def _and_expr(self) -> _Node:
        node = self._not_expr()
        while self._peek_keyword() == "and":
            self._next()
            right = self._not_expr()
            node = self._bool_op(node, right, np.logical_and, "and")
        return node

    @staticmethod
    def _bool_op(left: _Node, right: _Node, op, name: str) -> _Node:
        if left.kind != "bool" or right.kind != "bool":
            raise ScriptError(f"Both sides of '{name}' must be true/false conditions")
        return _Node("bool", lambda df, a=left, b=right: op(a.eval(df), b.eval(df)))

    def _not_expr(self) -> _Node:
        if self._peek_keyword() == "not":
            self._next()
            operand = self._not_expr()
            if operand.kind != "bool":
                raise ScriptError("'not' needs a true/false condition")
            return _Node("bool", lambda df, a=operand: np.logical_not(a.eval(df)))
        return self._comparison()

    def _comparison(self) -> _Node:
        left = self._additive()
        token = self._peek()

        if token is not None and token.kind == "op" and token.value in (">", ">=", "<", "<=", "==", "!="):
            op = self._next().value
            right = self._additive()
            if left.kind != "num" or right.kind != "num":
                raise ScriptError(f"'{op}' compares numbers, not conditions")
            ops = {
                ">": np.greater,
                ">=": np.greater_equal,
                "<": np.less,
                "<=": np.less_equal,
                "==": np.equal,
                "!=": np.not_equal,
            }
            fn = ops[op]

            def compare(df, a=left, b=right, fn=fn):
                with np.errstate(invalid="ignore"):
                    return fn(a.eval(df), b.eval(df))

            return _Node("bool", compare)

        if self._peek_keyword() == "crosses":
            self._next()
            direction = self._peek_keyword()
            if direction not in ("above", "below"):
                raise ScriptError("'crosses' must be followed by 'above' or 'below'")
            self._next()
            right = self._additive()
            if left.kind != "num" or right.kind != "num":
                raise ScriptError("'crosses' compares numbers, not conditions")

            def crosses(df, a=left, b=right, direction=direction):
                left_values = a.eval(df)
                right_values = b.eval(df)
                with np.errstate(invalid="ignore"):
                    if direction == "above":
                        state = left_values > right_values
                    else:
                        state = left_values < right_values
                state = pd.Series(state, index=df.index).fillna(False).astype(bool)
                return state & ~state.shift(1, fill_value=False)

            return _Node("bool", crosses)

        return left

    def _additive(self) -> _Node:
        node = self._term()
        while True:
            token = self._peek()
            if token is None or token.kind != "op" or token.value not in ("+", "-"):
                return node
            op = self._next().value
            right = self._term()
            node = self._num_op(node, right, np.add if op == "+" else np.subtract, op)

    def _term(self) -> _Node:
        node = self._unary()
        while True:
            token = self._peek()
            if token is None or token.kind != "op" or token.value not in ("*", "/"):
                return node
            op = self._next().value
            right = self._unary()
            node = self._num_op(node, right, np.multiply if op == "*" else np.divide, op)

    @staticmethod
    def _num_op(left: _Node, right: _Node, op, name: str) -> _Node:
        if left.kind != "num" or right.kind != "num":
            raise ScriptError(f"'{name}' needs numbers on both sides")
        return _Node("num", lambda df, a=left, b=right: op(a.eval(df), b.eval(df)))

    def _unary(self) -> _Node:
        token = self._peek()
        if token is not None and token.kind == "op" and token.value == "-":
            self._next()
            operand = self._unary()
            if operand.kind != "num":
                raise ScriptError("'-' needs a number")
            return _Node("num", lambda df, a=operand: np.negative(a.eval(df)))
        return self._atom()

    def _atom(self) -> _Node:
        token = self._next()

        if token.kind == "number":
            value = float(token.value)
            return _Node("num", lambda df, v=value: v)

        if token.kind == "op" and token.value == "(":
            node = self._or_expr()
            self._expect_op(")")
            return node

        if token.kind == "name":
            name = token.value.lower()
            if name in _KEYWORDS:
                raise ScriptError(f"Unexpected '{token.value}' here")

            following = self._peek()
            is_call = following is not None and following.kind == "op" and following.value == "("
            if is_call:
                return self._call(token.value)

            if name in SERIES_NAMES:
                return _Node("num", lambda df, n=name: _series_lower(df, n))

            raise ScriptError(
                f"Unknown name '{token.value}' — use one of {', '.join(SERIES_NAMES)}, "
                "or a function like SMA, EMA, RSI, ATR, Highest, Lowest"
            )

        raise ScriptError(f"Unexpected '{token.value}'")

    def _call(self, raw_name: str) -> _Node:
        name = raw_name.lower()
        self._expect_op("(")
        args: list[_Node] = [self._or_expr()]
        while self._peek() is not None and self._peek().kind == "op" and self._peek().value == ",":
            self._next()
            args.append(self._or_expr())
        self._expect_op(")")

        if name in _SERIES_FUNCS:
            if len(args) != 2:
                raise ScriptError(f"{raw_name} takes 2 inputs: {raw_name}(series, period)")
            series_node, window_node = args
            if series_node.kind != "num":
                raise ScriptError(f"The first input to {raw_name} must be a price/volume series")
            window = _require_window(window_node, raw_name)
            fn = _SERIES_FUNCS[name]

            def call_series(df, s=series_node, w=window, fn=fn):
                values = s.eval(df)
                if not isinstance(values, pd.Series):
                    raise ScriptError(f"The first input to {raw_name} must vary bar to bar")
                return fn(values, w)

            return _Node("num", call_series)

        if name in _FRAME_FUNCS:
            if len(args) != 1:
                raise ScriptError(f"{raw_name} takes 1 input: {raw_name}(period)")
            window = _require_window(args[0], raw_name)
            fn = _FRAME_FUNCS[name]
            return _Node("num", lambda df, w=window, fn=fn: fn(df, w))

        raise ScriptError(f"Unknown function '{raw_name}' — available: SMA, EMA, RSI, ATR, Highest, Lowest")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CompiledScript:
    """A parsed, type-checked strategy rule ready to evaluate against bars."""

    source: str
    _root: _Node

    def evaluate(self, df: pd.DataFrame) -> pd.Series:
        """Return a boolean signal Series aligned to ``df.index`` (NaN → False)."""
        result = self._root.eval(df)
        if not isinstance(result, pd.Series):
            result = pd.Series(bool(result), index=df.index)
        return result.fillna(False).astype(bool)


def compile_script(source: str) -> CompiledScript:
    """Compile rule text to a :class:`CompiledScript`; raises :class:`ScriptError`."""
    if source is None or not source.strip():
        raise ScriptError("The script is empty — write a condition like 'close > SMA(close, 50)'")

    tokens = _tokenize(source)
    root = _Parser(tokens).parse()
    if root.kind != "bool":
        raise ScriptError(
            "The script must produce a true/false signal — compare values, "
            "e.g. 'close > SMA(close, 50)'"
        )
    return CompiledScript(source=source.strip(), _root=root)
