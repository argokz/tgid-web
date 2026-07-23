from pathlib import Path
import re

root = Path(r"h:\projects\tgid-app\web-itwin\components")
files = [
    "DefectJournalDialog.vue",
    "RepairJournalDialog.vue",
    "ShurfJournalDialog.vue",
    "InspectionJournalDialog.vue",
    "PressureTestJournalDialog.vue",
    "TechnicalConditionJournalDialog.vue",
    "CorrosionIndicatorJournalDialog.vue",
]

# Match delete buttons that take args
BTN_RE = re.compile(
    r"<v-btn(?P<body>[\s\S]*?@click=\"delete\w+\([^)]*\)\"[\s\S]*?)>",
    re.MULTILINE,
)

# Also multi-line saveChanges where @click is on its own line after other attrs
SAVE_RE = re.compile(
    r"<v-btn(?P<body>(?:(?!</?v-btn).)*?@click=\"saveChanges\"(?:(?!</?v-btn).)*?)>",
    re.MULTILINE | re.DOTALL,
)


def ensure_vif(body: str) -> str:
    if "mutationsEnabled" in body:
        return body
    m = re.search(r'v-if="([^"]*)"', body)
    if m:
        old = m.group(1)
        return body[: m.start()] + f'v-if="mutationsEnabled && ({old})"' + body[m.end() :]
    return ' v-if="mutationsEnabled"' + body


for name in files:
    path = root / name
    text = path.read_text(encoding="utf-8")
    orig = text

    def repl(match: re.Match) -> str:
        return "<v-btn" + ensure_vif(match.group("body")) + ">"

    text = BTN_RE.sub(repl, text)
    text = SAVE_RE.sub(repl, text)

    if text != orig:
        path.write_text(text, encoding="utf-8")
        print("patched", name)
    else:
        print("ok", name)
