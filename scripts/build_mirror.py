from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

MIRROR_ROOT = Path(__file__).resolve().parents[1]
SYSTEM_ROOT = MIRROR_ROOT.parent / "a-share-trend-system-v1.0"
sys.path.insert(0, str(SYSTEM_ROOT))

from daily_archive import sync_reports  # noqa: E402


def main() -> None:
    reports = sync_reports()
    for report in reports:
        if report.get("recordType") in {"proactive_ai", "auto_ai", "automatic_ai", "gpt"}:
            report["recordType"] = "gpt"
        elif report.get("recordType") == "mavis":
            report["recordType"] = "mavis"
        else:
            report["recordType"] = "manual"
    target = MIRROR_ROOT / "reports.json"
    previous = {}
    if target.exists():
        try:
            previous = json.loads(target.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            previous = {}
    generated_at = (
        previous.get("generatedAt")
        if previous.get("reports") == reports
        else datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(timespec="seconds")
    )
    payload = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "reportCount": len(reports),
        "reports": reports,
    }
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {len(reports)} reports -> {target}")


if __name__ == "__main__":
    main()
