# 项目设计说明书

- [Word 文档](邻里闲置_项目设计说明书.docx)
- [PDF 排版预览](邻里闲置_项目设计说明书.pdf)

当前报告共 16 页，包含项目背景、范围、技术方案、4 张 Web 原型截图及页面说明、10 张独立 Chen E-R 图、关系模式和交付状态。文档和截图均明确标注原型，不代表后端、数据库、真实 LLM 或业务验收已经完成。

## 来源与复现

Web 原型源码在 `docs/prototype`；浏览器截图及来源记录在 `screenshots/manifest.json`；E-R 图来源在 `docs/engineering/diagrams`。

1. 启动本地原型：`python3 -m http.server 8765 --bind 127.0.0.1 --directory docs/prototype`。
2. 在已安装 Playwright 与 Chromium 的 Node 环境运行 `node scripts/capture_report.cjs`。
3. 在已安装 python-docx 的 Python 环境运行 `python3 scripts/build_report.py`。
4. 用具备中文字体的 Word 或 LibreOffice 导出 PDF，并检查版式。本文默认中文字体 Songti SC / PingFang SC；Linux 环境需要提供相应字体或配置中文字体替代。

截图检查：1440×960 桌面和 390×844 手机共 8 张；无横向溢出或页面脚本异常；筛选、搜索空态、意向切换、采用示例建议、取消与完成二次确认通过。Word 包内已核验 14 张内嵌图片，PDF 已检查中文显示、截图、E-R 图和分页。以上只验证原型与报告。

后续 #12 完成交付时，使用真实应用运行截图和实际迁移核对结果更新本报告，补充真实 LLM、测试与视频证据；此设计报告不用于提前关闭 #12。
