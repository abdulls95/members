#!/usr/bin/env python3
"""Narrow, non-shell wrapper for the pinned Sherlock tool payload."""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

USERNAME = re.compile(r"[A-Za-z0-9_.-]{1,64}", re.ASCII)
SITE = re.compile(r"[A-Za-z0-9_. -]{1,64}", re.ASCII)
MAX_SITES = 5


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run a bounded Sherlock username check inside a CORNOD guest."
    )
    parser.add_argument("username", help="One username (1–64 safe ASCII characters).")
    parser.add_argument(
        "--site",
        action="append",
        required=True,
        help=f"Exact Sherlock site name; repeat up to {MAX_SITES} times.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    if not USERNAME.fullmatch(args.username):
        print("Invalid username: use 1–64 letters, digits, dots, underscores or hyphens.", file=sys.stderr)
        return 2
    if not 1 <= len(args.site) <= MAX_SITES:
        print(f"Select between 1 and {MAX_SITES} sites.", file=sys.stderr)
        return 2
    if any(not SITE.fullmatch(site) for site in args.site):
        print("Invalid site name.", file=sys.stderr)
        return 2
    if len({site.casefold() for site in args.site}) != len(args.site):
        print("Duplicate site names are not allowed.", file=sys.stderr)
        return 2

    output_dir = Path("/workspace/results")
    output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chdir(output_dir)

    command = [
        "sherlock",
        "--local",
        "--timeout", "15",
        "--no-color",
        "--csv",
    ]
    for site in args.site:
        command.extend(["--site", site])
    command.append(args.username)

    # No shell, proxy, arbitrary URL, custom JSON source or user-supplied flags.
    return subprocess.run(command, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
