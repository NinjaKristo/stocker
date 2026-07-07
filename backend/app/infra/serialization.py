"""Shared serialization helpers for the infrastructure layer.

These utilities handle type conversions between external libraries (numpy,
pandas) and Python-native types suitable for JSON/SQLAlchemy persistence.
"""

from __future__ import annotations

import math
from datetime import date, datetime
from typing import Any, Optional


def json_safe(value: Any) -> Any:
    """Recursively coerce values to strict JSON-safe Python primitives."""
    converted = convert_numpy_types(value)
    if isinstance(converted, dict):
        return {str(key): json_safe(item) for key, item in converted.items()}
    if isinstance(converted, list):
        return [json_safe(item) for item in converted]
    if isinstance(converted, tuple):
        return [json_safe(item) for item in converted]
    if isinstance(converted, set):
        return [json_safe(item) for item in converted]
    if isinstance(converted, (datetime, date)):
        return converted.isoformat()
    if isinstance(converted, float) and not math.isfinite(converted):
        return None
    return converted


def sanitize_sparkline(value: Any) -> Optional[list[float]]:
    """Return a finite-float list, or ``None`` if any element is null/non-finite.

    Sparkline payloads serialised through ``convert_numpy_types`` get NaN/Inf
    rewritten to ``None``, which then fails ``List[float]`` validation in the
    response schemas.  Collapsing the whole sparkline to ``None`` keeps the
    surrounding row exportable.
    """
    if value is None:
        return None
    if not isinstance(value, (list, tuple)):
        return None
    sanitized: list[float] = []
    for element in value:
        if element is None:
            return None
        try:
            as_float = float(element)
        except (TypeError, ValueError):
            return None
        if not math.isfinite(as_float):
            return None
        sanitized.append(as_float)
    return sanitized


def normalize_string_list(value: object) -> list[str]:
    """Normalize a scalar-or-sequence value into a clean list of strings."""
    if value is None:
        return []
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if isinstance(value, (list, tuple, set)):
        normalized: list[str] = []
        for item in value:
            if item is None:
                continue
            text = item.strip() if isinstance(item, str) else str(item).strip()
            if text:
                normalized.append(text)
        return normalized
    text = str(value).strip()
    return [text] if text else []


def convert_numpy_types(obj: object) -> object:
    """Recursively convert numpy/pandas types to native Python types.

    Handles: numpy scalars (bool, int, float), ndarrays, NaN/Inf → None,
    datetime/date → ISO string.  Safe to call even when numpy is not
    installed — falls through to the identity return.
    """
    try:
        import numpy as np
    except ImportError:
        # numpy not installed — nothing to convert
        if isinstance(obj, dict):
            return {k: convert_numpy_types(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [convert_numpy_types(i) for i in obj]
        return obj

    numpy_int_types = tuple(
        type_
        for name in ("int_", "intc", "intp", "int8", "int16", "int32", "int64")
        if (type_ := getattr(np, name, None)) is not None
    )
    numpy_float_types = tuple(
        type_
        for name in ("float_", "float16", "float32", "float64")
        if (type_ := getattr(np, name, None)) is not None
    )

    if isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif numpy_int_types and isinstance(obj, numpy_int_types):
        return int(obj)
    elif numpy_float_types and isinstance(obj, numpy_float_types):
        val = float(obj)
        if np.isnan(val) or np.isinf(val):
            return None
        return val
    elif isinstance(obj, np.ndarray):
        return convert_numpy_types(obj.tolist())
    elif obj is None:
        return None
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    else:
        return obj
