#!/usr/bin/env python3
"""Generate the committed static Cairo Bold (wght=700, slnt=0) from the authoritative upstream variable font.

F9 D-F9-FONT (Owner-approved Option B, an explicit exception to the earlier font STOP rule).

  pip install -r tools/fonts/requirements.txt          # fonttools==4.55.3, NOT an Android dependency
  curl -sSL -o /tmp/Cairo-var.ttf \
    "https://raw.githubusercontent.com/Gue3bara/Cairo/73d16933c6a0f341c27a69e401da83dcb0d53114/fonts/Cairo/variable/Cairo%5Bslnt%2Cwght%5D.ttf"
  python3 tools/fonts/generate_cairo_bold.py /tmp/Cairo-var.ttf app/src/main/res/font/cairo_bold.ttf

The output is deterministic (head timestamps are not recalculated, no random data). A changed output SHA-256 is NOT silently
accepted: FontCoverageTest compares the committed file with the hash recorded in docs/android/font-sources-and-licenses.md, so any
regeneration that changes the bytes needs an explicit, reviewed update of both.
"""
import hashlib
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

UPSTREAM_REPO = "https://github.com/Gue3bara/Cairo"
UPSTREAM_COMMIT = "73d16933c6a0f341c27a69e401da83dcb0d53114"
INPUT_SHA256 = "667c987182391c91f4e57a2f455b1794fb5e3ee6ca4ef3383e86bb690fa9c964"
FONTTOOLS_VERSION = "4.55.3"
LOCATION = {"wght": 700, "slnt": 0}


def sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def main(argv):
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    import fontTools
    if fontTools.version != FONTTOOLS_VERSION:
        print("fontTools %s required, found %s" % (FONTTOOLS_VERSION, fontTools.version), file=sys.stderr)
        return 2
    source, target = argv[1], argv[2]
    if sha256(source) != INPUT_SHA256:
        print("input is not the pinned upstream variable font (sha256 mismatch)", file=sys.stderr)
        return 2
    font = TTFont(source, recalcTimestamp=False)
    static = instancer.instantiateVariableFont(font, LOCATION, inplace=False)
    if "STAT" in static:                                          # axis value tables describe the variable font, not a static face
        del static["STAT"]
    for table in ("fvar", "gvar", "avar", "STAT", "HVAR", "MVAR", "cvar"):
        assert table not in static, "variation table %s must be gone from a static instance" % table

    os2 = static["OS/2"]
    os2.usWeightClass = 700
    os2.fsSelection = (os2.fsSelection | (1 << 5)) & ~(1 << 6)  # BOLD on, REGULAR off
    static["head"].macStyle |= 1                                  # bold

    name = static["name"]
    for name_id in (16, 17, 21, 22, 25):                          # typographic/WWS/variations names do not apply to a static face
        name.removeNames(nameID=name_id)
    unique = "Cairo Bold;static instance wght=700 slnt=0;upstream %s;fontTools %s" % (UPSTREAM_COMMIT[:12], FONTTOOLS_VERSION)
    for name_id, text in ((1, "Cairo"), (2, "Bold"), (3, unique), (4, "Cairo Bold"), (6, "Cairo-Bold")):
        name.removeNames(nameID=name_id)
        name.setName(text, name_id, 3, 1, 0x409)
        name.setName(text, name_id, 1, 0, 0)
    static.save(target)
    print("wrote %s sha256=%s" % (target, sha256(target)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
