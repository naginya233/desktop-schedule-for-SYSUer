# 🚀 Tauri Desktop Widget (Semester Toolkit)

这是一个基于 **Tauri 2.0** + **React** 构建的高级桌面小组件，专为学生/学者打造。支持毛玻璃视觉效果、开机自启、跨周课程过滤以及自由拖拽布局。

---

## ✨ 核心特性

- **自由磁贴布局**：所有功能模块（课程表、DDL、待办等）均可自由拖拽放置，位置自动保存。
- **原生窗口拖拽**：通过顶部专门设计的 Dragbar 实现平滑的窗口移动。
- **智慧课程表**：
  - 支持 **跨周过滤**：根据开学日期自动显示当前周次的课程。
  - **课程表转换器**：内置 Python 脚本，支持将教务系统导出的 Word XML (.doc) 课程表一键转换为 JSON。
- **视觉风格**：
  - **毛玻璃 (Glassmorphism)**：适配 Windows 透明效果，支持深色/浅色模式切换。
  - **LXGW 文楷**：内置精美开源中文字体。
- **轻量化**：基于 Rust 构建，极低的内存占用，支持开机自启。

---

## 🛠️ 工具：课程表转换器 (`doc_to_schedule_json.py`)

你可以直接从教务系统导出 Word 版课程表（通常是 `.doc` 结尾的 XML 格式），然后使用此工具：

```bash
# 自动识别并输出到 schedule.json
python doc_to_schedule_json.py "你的课程表.doc"
```

转换后的 `schedule.json` 会由小组件在运行时自动识别（开发模式下）或通过导入功能载入。

---

## 🚀 快速开始

### 1. 开发模式
```bash
npm install
npx tauri dev
```

### 2. 构建成品 (生成 .exe)
```bash
npx tauri build
```
构建成功后，在 `src-tauri/target/release/` 下找到 `widget.exe` 即可直接使用。

---

## 📋 数据格式
项目使用 `schedule.json` 作为课程源。你可以在 `schedule.json.sample` 中查看示例格式。

- `semesterStart`: 设置为周一的日期，用于计算当前属于第几周。
- `schedule`: 按星期排列的课程条目。

---

## 🤝 声明
本项目仅用于学习交流。
