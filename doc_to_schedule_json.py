#!/usr/bin/env python3
"""
教务系统课程表 Word XML (.doc) → schedule.json 转换器

用法:
    python doc_to_schedule_json.py 课程表.doc
    python doc_to_schedule_json.py 课程表.doc output.json
    python doc_to_schedule_json.py 课程表.doc --stdout
"""

import re
import json
import sys
from pathlib import Path

PERIODS_DEFINITION = [
    {"index": 1,  "time": "08:00~08:45"},
    {"index": 2,  "time": "08:55~09:40"},
    {"index": 3,  "time": "10:10~10:55"},
    {"index": 4,  "time": "11:05~11:50"},
    {"index": 5,  "time": "14:20~15:05"},
    {"index": 6,  "time": "15:15~16:00"},
    {"index": 7,  "time": "16:30~17:15"},
    {"index": 8,  "time": "17:25~18:10"},
    {"index": 9,  "time": "19:00~19:45"},
    {"index": 10, "time": "19:55~20:40"},
    {"index": 11, "time": "20:50~21:35"},
]

WEEKDAY_CN = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def read_xml(filepath: str) -> str:
    suffix = Path(filepath).suffix.lower()
    if suffix == ".docx":
        import zipfile
        with zipfile.ZipFile(filepath) as z:
            return z.read("word/document.xml").decode("utf-8")
    else:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()


def parse_cell(cxml: str) -> dict:
    body = re.sub(r'<w:tcPr>.*?</w:tcPr>', '', cxml, flags=re.DOTALL)
    gs   = re.search(r'<w:gridSpan w:val="(\d+)"', cxml)
    span = int(gs.group(1)) if gs else 1
    vm_restart = bool(re.search(r'<w:vMerge w:val="restart"', cxml))
    vm_any     = bool(re.search(r'<w:vMerge', cxml))
    vmerge = "restart" if vm_restart else ("continue" if vm_any else None)
    texts  = re.findall(r'<w:t[^>]*>(.*?)</w:t>', body, re.DOTALL)
    return {"text": "".join(texts).strip(), "span": span, "vmerge": vmerge}


def expand_row(row_xml: str) -> list[tuple[int, dict]]:
    """返回 [(physical_col, cell), ...] 按物理列号展开"""
    result, col = [], 0
    for cxml in re.findall(r'<w:tc>(.*?)</w:tc>', row_xml, re.DOTALL):
        cell = parse_cell(cxml)
        result.append((col, cell))
        col += cell["span"]
    return result


def extract_semester(xml: str) -> str:
    for para in re.findall(r'<w:p[ >].*?</w:p>', xml, re.DOTALL):
        texts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', para, re.DOTALL)
        text  = "".join(texts).strip()
        if re.search(r'\d{4}.*学期', text):
            return text
    return ""


def convert(filepath: str) -> dict:
    xml = read_xml(filepath)

    table_match = re.search(r'<w:tbl>(.*?)</w:tbl>', xml, re.DOTALL)
    if not table_match:
        raise ValueError("未找到课程表格")

    rows_xml = re.findall(r'<w:tr[ >].*?</w:tr>', table_match.group(1), re.DOTALL)

    # 从表头建立 物理列号 → 星期 映射
    col_to_day: dict[int, str] = {}
    for col, cell in expand_row(rows_xml[0]):
        if cell["text"] in WEEKDAY_CN:
            day = WEEKDAY_EN[WEEKDAY_CN.index(cell["text"])]
            for c in range(col, col + cell["span"]):
                col_to_day[c] = day

    # 遍历数据行，按 vMerge 聚合课程
    schedule: dict[str, list] = {d: [] for d in WEEKDAY_EN}
    active:   dict[int, dict] = {}  # col -> {entry, ...}

    for row_xml in rows_xml[1:]:
        row = expand_row(row_xml)
        period = None
        m = re.search(r'第(\d+)节', row[0][1]["text"])
        if m:
            period = int(m.group(1))

        for col, cell in row:
            if col not in col_to_day:
                continue
            day    = col_to_day[col]
            text   = cell["text"]
            vmerge = cell["vmerge"]

            if vmerge == "restart" and text:
                entry = {"periods_start": period, "periods_end": period, "content": text}
                active[col] = entry
                schedule[day].append(entry)
            elif vmerge == "continue":
                if col in active:
                    active[col]["periods_end"] = period
            else:
                active.pop(col, None)
                if text:
                    entry = {"periods_start": period, "periods_end": period, "content": text}
                    schedule[day].append(entry)

    # 整理输出格式
    final_schedule = {}
    for day in WEEKDAY_EN:
        entries = []
        for e in schedule[day]:
            s, en = e["periods_start"], e["periods_end"]
            periods = list(range(s, en + 1)) if s and en else ([s] if s else [])
            entries.append({"periods": periods, "content": e["content"]})
        entries.sort(key=lambda x: x["periods"][0] if x["periods"] else 0)
        final_schedule[day] = entries

    return {
        "semester":           extract_semester(xml),
        "periods_definition": PERIODS_DEFINITION,
        "schedule":           final_schedule,
    }


def main():
    if len(sys.argv) < 2:
        print(f"用法: python {Path(sys.argv[0]).name} 课程表.doc [output.json | --stdout]")
        sys.exit(1)

    result    = convert(sys.argv[1])
    json_str  = json.dumps(result, ensure_ascii=False, indent=2)
    stdout    = len(sys.argv) > 2 and sys.argv[2] == "--stdout"
    out_path  = None if stdout else (sys.argv[2] if len(sys.argv) > 2 else "schedule.json")

    if stdout:
        print(json_str)
    else:
        Path(out_path).write_text(json_str, encoding="utf-8")
        total = sum(len(v) for v in result["schedule"].values())
        print(f"✅ 已输出到 {out_path}（学期: {result['semester']}，共 {total} 条课程）")


if __name__ == "__main__":
    main()
