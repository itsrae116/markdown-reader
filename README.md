# Markdown Reader

一个本地优先的 Markdown 阅读工作台，用来打开本机 Markdown 文件或文件夹，把项目文档、知识库和流程说明渲染成更适合阅读、检索和批注的页面。

## 产品定位

Markdown Reader 面向长期阅读本地 Markdown 文档的人：需求文档、项目方案、知识库、架构说明、工作流沉淀都可以直接拖入或作为文件夹打开。

产品核心不是 Markdown 编辑器，而是阅读器：

- 本地知识库优先：打开本机 `.md` / `.markdown` 文件或文件夹，递归生成文档库。
- 阅读体验优先：优化标题、表格、代码块、图示和长文目录跳转。
- 批注优先：正文选区支持高亮、划线和批注，右侧只集中展示批注线程。
- 隐私优先：文件内容不上传，不写回原 Markdown，不依赖账号、云同步或后端数据库。

## 核心能力

### 本地文档库

- 支持拖拽单个 Markdown 文件。
- 支持打开本地文件夹并递归扫描 Markdown 文档。
- 左侧展示文档库层级，文档名自动隐藏 `.md` / `.markdown` 后缀。
- 支持最近记录和阅读位置恢复。

### Markdown 阅读增强

- 基础 Markdown：标题、段落、列表、引用、链接、代码块等常见语法。
- 表格增强：横向滚动、固定表头、阅读型表格样式。
- Mermaid 图：支持 `mermaid` 代码块渲染流程图、架构图和关系图。
- 代码块增强：语言标签、复制入口、等宽字体和横向滚动。
- API 文档块：支持 `api` 代码块按接口方法、路径和分区内容展示。
- ASCII / 树形图：保持原始缩进和等宽排版，避免图形结构被自动折行破坏。

### 目录、搜索与定位

- 根据 Markdown 标题生成目录。
- 目录固定在工作台侧栏，正文滚动时保持锚点定位。
- 支持当前文档搜索。
- 支持已授权文档库范围内搜索，并可跳转到命中文档。

### 标记与批注

- 选中正文后显示浮动工具条。
- 高亮和划线可添加，也可再次选中后取消。
- 批注会在右侧打开输入框，并进入批注线程。
- 右侧面板只展示批注，不混入高亮和划线列表。
- 所有标记和批注只保存在当前浏览器本地。

### 本地偏好

- 支持阅读主题、字号、阅读宽度调整。
- 支持左右面板显隐。
- 支持清除当前浏览器保存的历史、阅读位置、标记、批注和偏好。

## 不做什么

当前版本明确不做：

- Markdown 编辑和写回原文件
- 账号体系
- 云同步
- 多人协作
- 后端数据库保存文档内容
- 远程 URL 文件读取
- PDF 导出
- 批注备份 / 恢复

这些能力如果后续进入产品范围，需要重新设计数据模型、权限边界和交互流程。

## 技术栈

### 前端

- Vue 3
- TypeScript
- Vite
- Pinia
- markdown-it
- DOMPurify
- Mermaid

### 后端

- Python
- FastAPI

后端当前只提供基础健康检查，不接收、不保存、不索引 Markdown 文件内容。V1 的业务闭环主要在浏览器本地完成。

## 项目结构

```text
markdown-reader/
├── frontend/              # Vue 3 阅读器前端
│   ├── src/pages/         # 启动页、工作台、搜索、设置
│   ├── src/services/      # 本地文件、渲染增强、搜索、本地保存
│   ├── src/stores/        # Pinia 状态
│   └── tests/             # 前端自动验证脚本
├── backend/               # FastAPI 健康检查服务
│   ├── src/
│   └── tests/
├── pyproject.toml         # 后端测试和代码检查配置
└── README.md
```

## 本地启动

### 1. 启动前端

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

打开：

```text
http://127.0.0.1:5175/
```

### 2. 启动后端健康检查（可选）

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cd backend
PYTHONPATH=.. ../.venv/bin/python -m uvicorn src.main:app --host 127.0.0.1 --port 8003
```

健康检查：

```text
http://127.0.0.1:8003/health
```

预期返回：

```json
{"code":200,"message":"success","data":{"status":"ok","service":"markdown-reader"}}
```

## 验证命令

前端：

```bash
cd frontend
npm run typecheck
npm run build
npm run test:t008
npm run test:t009
```

后端：

```bash
.venv/bin/python -m pytest backend/tests
```

## 使用方式

1. 打开前端页面。
2. 拖入一个 Markdown 文件，或选择一个本地 Markdown 文件夹。
3. 在左侧文档库切换文档。
4. 在正文中阅读、搜索、目录跳转。
5. 选中文字后创建高亮、划线或批注。
6. 在右侧批注栏查看和追加批注。

## 数据与隐私

- Markdown 文件内容只在浏览器本地读取。
- 原始 Markdown 文件不会被修改。
- 历史、阅读位置、高亮、划线、批注和偏好保存在当前浏览器本地。
- 清除浏览器缓存或更换浏览器后，本地记录可能丢失。
- 当前版本不上传文件、不提供云同步、不提供多人协作。

## 版本记录

### v1.1

- 增强表格、Mermaid 图、代码块和 API 文档块展示。
- 修复异常 Markdown fence 导致的大段内容误入代码块问题。
- 优化 ASCII / 树形图的等宽排版和横向滚动。
- 固定工作台目录区域，正文滚动时保持目录锚点定位。
- 调整高亮、划线和批注交互：标记在正文内体现，批注进入右侧线程。

### v1.0

- 完成本地 Markdown 文件 / 文件夹读取。
- 完成阅读工作台、文档库、目录、搜索、历史、阅读位置恢复。
- 完成高亮、划线、批注和本地偏好设置。
