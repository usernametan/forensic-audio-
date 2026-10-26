"""Filesystem object storage. Originals are read-only; work happens on copies."""
import os
import shutil
from pathlib import Path
from .config import settings


def _ensure() -> Path:
    base = Path(settings.storage_dir)
    for sub in ("originals", "working", "outputs"):
        (base / sub).mkdir(parents=True, exist_ok=True)
    return base


def store_original(src: Path, dest_name: str) -> Path:
    from .hashutil import sha256_file
    base = _ensure()
    dest = base / "originals" / dest_name
    if dest.exists():
        # identical content (name embeds hash prefix) → reuse; else make unique
        try:
            if sha256_file(src) == sha256_file(dest):
                return dest
        except OSError:
            pass
        dest = base / "originals" / f"{dest.stem}_{os.urandom(3).hex()}{dest.suffix}"
    shutil.copyfile(src, dest)
    dest.chmod(0o444)  # read-only marker
    return dest


def new_working_copy(original: Path, run_id: str) -> Path:
    base = _ensure()
    dest = base / "working" / f"{run_id}_{original.name}"
    shutil.copyfile(original, dest)
    dest.chmod(0o644)
    return dest


def output_path(run_id: str, name: str) -> Path:
    base = _ensure()
    return base / "outputs" / f"{run_id}_{name}"
