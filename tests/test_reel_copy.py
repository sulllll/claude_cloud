"""The intro reel preloads its web-font slices from one sample string (COPY in reel.js).

Google Fonts splits Noto Sans KR into many unicode-range slices and the browser only
downloads the slices that the sample text touches, so any Korean or symbol character the
reel draws but COPY lacks would be drawn in a fallback font until its slice arrives.
"""

import re
import unittest
from pathlib import Path

REEL = Path(__file__).resolve().parent.parent / "site" / "reel" / "reel.js"
LITERAL = re.compile(r"'[^'\n]*'|\"[^\"\n]*\"|`[^`]*`")


def non_ascii(text):
    return {c for c in text if ord(c) > 126}


class ReelCopyTest(unittest.TestCase):
    def test_copy_covers_every_drawn_character(self):
        src = REEL.read_text(encoding="utf-8")
        start = src.index("const COPY =")
        end = src.index(";", start)
        copy_chars = non_ascii("".join(LITERAL.findall(src[start:end])))
        rest = src[:start] + src[end:]
        # string literals only: comments may use any characters, they are never drawn
        drawn = non_ascii("".join(LITERAL.findall(rest)))
        missing = sorted(drawn - copy_chars)
        self.assertEqual(missing, [], f"add these to COPY in reel.js: {''.join(missing)}")


if __name__ == "__main__":
    unittest.main()
