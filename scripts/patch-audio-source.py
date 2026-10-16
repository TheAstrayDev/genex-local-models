"""Apply the published LPAC path-only change to an explicit pinned audio.cpp checkout."""
from pathlib import Path
import argparse
import shutil
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path, help="audio.cpp checkout at the pinned source revision")
args = parser.parse_args()
root = args.source.resolve()
expected = "cf124a67cc55d8f65a9a15eec69edbff0fb212c8"
if subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip() != expected:
    raise RuntimeError("Unexpected audio.cpp source revision; no patch applied")
header = Path(__file__).parents[1] / "plugin/lpac_path.h"
shutil.copyfile(header, root / "include/engine/framework/io/lpac_path.h")
for file in (root / "src/framework").rglob("*.cpp"):
    text = file.read_text(encoding="utf-8")
    changed = text.replace("std::filesystem::weakly_canonical(", "genex_lpac::weakly_canonical(").replace("fs::weakly_canonical(", "genex_lpac::weakly_canonical(")
    if changed != text:
        changed = "// Modified by TheAstrayDev: LPAC path normalization only.\n" + changed
        if '#include "engine/framework/io/lpac_path.h"' not in changed:
            changed = '#include "engine/framework/io/lpac_path.h"\n' + changed
        file.write_text(changed, encoding="utf-8", newline="\n")
        print(file.relative_to(root))
