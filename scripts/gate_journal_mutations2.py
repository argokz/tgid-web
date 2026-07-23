from pathlib import Path
import re

root = Path(r"h:\projects\tgid-app\web-itwin\components")
files = list(root.glob("*JournalDialog.vue"))

# Multi-line v-btn with mutation clicks
BTN_RE = re.compile(
    r"<v-btn(?P<body>[\s\S]*?@click=\"(?P<fn>create\w+|startEdit(?:Season)?|save(?:Changes|Season|Inputs)|delete\w+|cancelEdit(?:Season)?)\"[\s\S]*?)>",
    re.MULTILINE,
)


def ensure_vif(body: str) -> str:
    if "mutationsEnabled" in body:
        return body
    m = re.search(r'v-if="([^"]*)"', body)
    if m:
        old = m.group(1)
        if "mutationsEnabled" in old:
            return body
        return body[: m.start()] + f'v-if="mutationsEnabled && ({old})"' + body[m.end() :]
    # insert after <v-btn
    return ' v-if="mutationsEnabled"' + body


for path in files:
    if path.name == "AlsekoJournalDialog.vue":
        continue
    text = path.read_text(encoding="utf-8")
    orig = text

    def repl(match: re.Match) -> str:
        return "<v-btn" + ensure_vif(match.group("body")) + ">"

    text = BTN_RE.sub(repl, text)
    if text != orig:
        path.write_text(text, encoding="utf-8")
        print("patched", path.name)
    else:
        print("ok", path.name)
