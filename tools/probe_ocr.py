#!/usr/bin/env python3
"""Prova (via analysis.yml): prepara i file del motore di lettura (rn/scripts/ocr-files.js) in analysis/ocr per provarli in locale."""
import subprocess, sys
r = subprocess.run(["node", "rn/scripts/ocr-files.js", "analysis/ocr"], capture_output=True, text=True)
print(r.stdout, r.stderr); sys.exit(r.returncode)
