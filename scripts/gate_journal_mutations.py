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
    "NetworkArmatureJournalDialog.vue",
    "NetworkRegulatorJournalDialog.vue",
    "NetworkBypassJournalDialog.vue",
    "NetworkDiaphragmJournalDialog.vue",
    "PumpEquipmentJournalDialog.vue",
    "ElectricalNetworkJournalDialog.vue",
    "TemperatureGraphJournalDialog.vue",
    "HeatLossJournalDialog.vue",
]

CLICK_RE = re.compile(
    r"<v-btn(?P<attrs>[^>]*@click=\"(?P<fn>create\w+|startEdit(?:Season)?|save(?:Changes|Season|Inputs)|delete\w+|cancelEdit(?:Season)?)\"[^>]*)>"
)


def inject_vif(attrs: str) -> str:
    if "mutationsEnabled" in attrs:
        return attrs
    # merge into existing v-if if present
    m = re.search(r'v-if="([^"]*)"', attrs)
    if m:
        old = m.group(1)
        if "mutationsEnabled" in old:
            return attrs
        return attrs[: m.start()] + f'v-if="mutationsEnabled && ({old})"' + attrs[m.end() :]
    return ' v-if="mutationsEnabled"' + attrs


for name in files:
    path = root / name
    text = path.read_text(encoding="utf-8")
    orig = text

    if "useMutationsEnabled" not in text:
        if "import { useMobile } from '~/composables/useMobile'" in text:
            text = text.replace(
                "import { useMobile } from '~/composables/useMobile'",
                "import { useMobile } from '~/composables/useMobile'\n"
                "import { useMutationsEnabled } from '~/composables/useMutationsEnabled'",
            )
        else:
            text = text.replace(
                '<script setup lang="ts">',
                '<script setup lang="ts">\n'
                "import { useMutationsEnabled } from '~/composables/useMutationsEnabled'",
            )

    if "const mutationsEnabled = useMutationsEnabled()" not in text:
        if "const { isMobile } = useMobile()" in text:
            text = text.replace(
                "const { isMobile } = useMobile()",
                "const { isMobile } = useMobile()\nconst mutationsEnabled = useMutationsEnabled()",
                1,
            )
        else:
            text = text.replace(
                "import { useMutationsEnabled } from '~/composables/useMutationsEnabled'",
                "import { useMutationsEnabled } from '~/composables/useMutationsEnabled'\n\n"
                "const mutationsEnabled = useMutationsEnabled()",
                1,
            )

    def repl(match: re.Match) -> str:
        attrs = inject_vif(match.group("attrs"))
        return f"<v-btn{attrs}>"

    text = CLICK_RE.sub(repl, text)

    if text != orig:
        path.write_text(text, encoding="utf-8")
        print("patched", name)
    else:
        print("unchanged", name)
