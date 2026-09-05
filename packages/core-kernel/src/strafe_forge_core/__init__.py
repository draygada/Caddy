"""Strafe Forge's server-authoritative CAD execution boundary.

The public wire adapter is intentionally kept separate from the kernel internals.  This
module exposes only versioned entry points once their cross-lane contract is frozen.
"""

from .diagnostics import Diagnostic, KernelError
from .registry import OperationDescriptor, OperationRegistry
from .scalars import ResolvedValue, resolve_parameters

__all__ = [
    "Diagnostic",
    "KernelError",
    "OperationDescriptor",
    "OperationRegistry",
    "ResolvedValue",
    "resolve_parameters",
]

__version__ = "0.1.0"

