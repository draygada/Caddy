"""Reproducible local benchmark evidence for the bounded core-kernel fixtures."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
import shlex
import sys
import time
from datetime import datetime, timezone
from fractions import Fraction
from importlib import metadata
from pathlib import Path
from typing import Callable

from strafe_forge_core.assembly import (
    AssemblyEngine,
    AssemblyProgram,
    Component,
    FixedTransform,
    PartDefinition,
)
from strafe_forge_core.program import PartProgram, ProgramOperation

from kernel_cases import bracket_program, engine, literal, manifest


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _canonical_sha256(value: object) -> str:
    payload = json.dumps(
        value,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("ascii")
    return hashlib.sha256(payload).hexdigest()


def _multibody_source_program() -> PartProgram:
    parameters = {
        "length": literal("length", "LENGTH", "10"),
        "width": literal("width", "LENGTH", "5"),
        "height": literal("height", "LENGTH", "2"),
        "dx": literal("dx", "LENGTH", "20"),
        "zero": literal("zero", "LENGTH", "0"),
    }
    operations = (
        ProgramOperation(
            "body:a",
            "primitive.box",
            1,
            (),
            {"length": "length", "width": "width", "height": "height"},
            (),
            {},
            True,
        ),
        ProgramOperation(
            "body:b",
            "primitive.box",
            1,
            (),
            {"length": "length", "width": "width", "height": "height"},
            (),
            {},
            True,
        ),
        ProgramOperation(
            "body:b:move",
            "transform.translate",
            1,
            ("body:b",),
            {"dx": "dx", "dy": "zero", "dz": "zero"},
            (),
            {},
            True,
        ),
    )
    return PartProgram(
        "part:benchmark-multibody",
        "rev:benchmark-multibody",
        {"length": "mm", "angle": "deg"},
        parameters,
        operations,
        {},
    )


def _multibody_assembly_fixture() -> tuple[AssemblyEngine, AssemblyProgram, dict[str, str]]:
    source_program = _multibody_source_program()
    source_result = engine().recompute(source_program)
    if source_result.status != "SUCCEEDED" or source_result.current_artifact is None:
        raise RuntimeError("Multibody benchmark source fixture failed to recompute")
    definition = PartDefinition.from_recompute(
        "definition:benchmark-multibody",
        source_result,
    )
    program = AssemblyProgram(
        "assembly:benchmark-two-component-multibody",
        "rev:benchmark-two-component-multibody",
        {definition.definition_id: definition},
        (
            Component(
                "component:benchmark-root",
                definition.definition_id,
                None,
                FixedTransform(),
                True,
                "bom:benchmark-multibody",
            ),
            Component(
                "component:benchmark-offset",
                definition.definition_id,
                None,
                FixedTransform(
                    (Fraction(50), Fraction(0), Fraction(0)),
                    "Z",
                    Fraction(90),
                ),
                True,
                "bom:benchmark-multibody",
            ),
        ),
    )
    fixture = {
        "identity": "two fixed components of a two-solid source part",
        "assembly_geometry_hash": program.geometry_hash,
        "source_part_geometry_hash": source_result.geometry_hash,
        "source_artifact_id": source_result.current_artifact.artifact_id,
        "source_record_hash": definition.source_record_hash,
    }
    return AssemblyEngine(manifest()), program, fixture


def _nearest_rank(samples: list[int], percentile: float) -> int:
    ordered = sorted(samples)
    rank = max(1, math.ceil(percentile * len(ordered)))
    return ordered[rank - 1]


def _measure(
    operation: Callable[[], object],
    *,
    warmups: int,
    samples: int,
) -> list[int]:
    for _ in range(warmups):
        result = operation()
        if getattr(result, "status", None) != "SUCCEEDED":
            raise RuntimeError("Benchmark warmup operation failed")
    observed: list[int] = []
    for _ in range(samples):
        started = time.perf_counter_ns()
        result = operation()
        elapsed = time.perf_counter_ns() - started
        if getattr(result, "status", None) != "SUCCEEDED":
            raise RuntimeError("Benchmark measured operation failed")
        observed.append(elapsed)
    return observed


def _distribution(samples: list[int]) -> dict[str, object]:
    return {
        "sample_count": len(samples),
        "raw_samples_ns": samples,
        "summary_ms": {
            "minimum": round(min(samples) / 1_000_000, 6),
            "p50_nearest_rank": round(_nearest_rank(samples, 0.50) / 1_000_000, 6),
            "p95_nearest_rank": round(_nearest_rank(samples, 0.95) / 1_000_000, 6),
            "maximum": round(max(samples) / 1_000_000, 6),
        },
    }


def _code_binding(repository: Path) -> dict[str, object]:
    source_root = repository / "packages/core-kernel/src/strafe_forge_core"
    paths = sorted(source_root.rglob("*.py"))
    paths.extend(
        (
            repository / "tests/core-kernel/kernel_cases.py",
            Path(__file__).resolve(),
        )
    )
    file_hashes = {
        path.relative_to(repository).as_posix(): _sha256_file(path)
        for path in sorted(set(paths))
    }
    return {
        "algorithm": "sha256(canonical-json(sorted relative-path -> file-sha256 map))",
        "tree_sha256": _canonical_sha256(file_hashes),
        "files": file_hashes,
        "self_reference_policy": (
            "The generated performance JSON and Git commit are excluded. The digest binds "
            "the exact source, fixture generator, and harness bytes measured without asking "
            "an output file or its eventual commit to hash itself."
        ),
    }


def _runtime_binding(repository: Path) -> dict[str, object]:
    dependency_versions = {
        name: metadata.version(name)
        for name in (
            "cadquery-ocp-novtk",
            "jsonschema",
            "rfc8785",
            "strafe-forge-core-kernel",
        )
    }
    runtime = {
        "python_executable": sys.executable,
        "python_implementation": platform.python_implementation(),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "machine": platform.machine(),
    }
    return {
        "runtime": runtime,
        "runtime_sha256": _canonical_sha256(runtime),
        "dependencies": dependency_versions,
        "dependencies_sha256": _canonical_sha256(dependency_versions),
        "lockfile": {
            "path": "packages/core-kernel/uv.lock",
            "sha256": _sha256_file(repository / "packages/core-kernel/uv.lock"),
        },
        "engine_manifest_hash": manifest().manifest_hash,
    }


def build_evidence(*, warmups: int, samples: int) -> dict[str, object]:
    repository = Path(__file__).resolve().parents[2]
    bracket = bracket_program()
    bracket_engine = engine()
    assembly_engine, assembly, assembly_fixture = _multibody_assembly_fixture()

    bracket_samples = _measure(
        lambda: bracket_engine.recompute(bracket),
        warmups=warmups,
        samples=samples,
    )
    assembly_samples = _measure(
        lambda: assembly_engine.evaluate(assembly),
        warmups=warmups,
        samples=samples,
    )
    bracket_distribution = _distribution(bracket_samples)
    bracket_distribution["fixture"] = {
        "identity": "kernel_cases.bracket_program(default arguments)",
        "document_id": bracket.document_id,
        "source_revision_id": bracket.source_revision_id,
        "geometry_hash": bracket.geometry_hash,
    }
    assembly_distribution = _distribution(assembly_samples)
    assembly_distribution["fixture"] = assembly_fixture

    return {
        "schema_version": "forge.core-performance-evidence/2",
        "observed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "command": shlex.join([sys.executable, *sys.argv]),
        "method": {
            "clock": "time.perf_counter_ns",
            "warmup_iterations": warmups,
            "measured_iterations_per_fixture": samples,
            "percentile_definition": (
                "Nearest-rank over samples sorted ascending: percentile p selects the "
                "one-based rank ceil(p * sample_count); p50 and p95 are reported."
            ),
            "process": (
                "single process, sequential, OCCT parallel algorithms disabled; no "
                "concurrent test or benchmark process"
            ),
            "scope": (
                "kernel-call latency only; excludes interpreter startup, IPC, storage, "
                "network, and browser rendering"
            ),
        },
        "bindings": {
            "code_and_fixture_generator": _code_binding(repository),
            "runtime_and_dependencies": _runtime_binding(repository),
        },
        "distributions": {
            "bracket_recompute_warm": bracket_distribution,
            "two_component_multibody_assembly_warm": assembly_distribution,
        },
        "claim_ceiling": (
            "Local observational benchmark only. It is not a service SLO and makes no "
            "cold-start, concurrency, load, container, cross-platform, tail-latency, or "
            "production claim."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--warmups", type=int, default=1)
    parser.add_argument("--samples", type=int, default=50)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    if arguments.warmups < 0 or arguments.samples < 1:
        parser.error("--warmups must be non-negative and --samples must be positive")

    rendered = json.dumps(
        build_evidence(warmups=arguments.warmups, samples=arguments.samples),
        indent=2,
        sort_keys=True,
    ) + "\n"
    if arguments.output is None:
        sys.stdout.write(rendered)
    else:
        arguments.output.write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    main()
