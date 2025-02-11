# 欢迎使用你的 VS Code 扩展 (QuickLingo)

本扩展实现了在 VS Code 编辑器中选中文本后，通过右键菜单调用翻译命令，将文本翻译为中文。扩展内部使用了基于 axios 的 HTTP 请求，与翻译大模型服务(例如 OpenAI API) 对接，并通过 Webview 面板实时展示翻译结果。

## 文件夹中的内容

* 此文件夹包含了扩展运行所需的全部文件。
* `package.json` - 清单文件：
  * 声明了扩展名称、版本号和简介。
  * 注册了命令 `quicklingo.translateToChinese`，此命令在编辑器的右键菜单中显示（只在有文本选中时出现）。
  * 定义了配置项，如 `quicklingo.apiKey`、`quicklingo.apiUrl`、`quicklingo.modelName` 与 `quicklingo.enableStreaming`，用于配置 API 请求参数。
* `extension.js` - 主逻辑文件：
  * 导出了 `activate` 方法，在扩展被激活时（比如执行翻译命令）调用。
  * 实现了翻译命令的处理逻辑，通过 axios 发起 HTTP 请求，根据配置决定是否使用流式输出与错误处理。
  * 通过 VS Code 的 Progress API 显示进度，同时集成超时与取消请求功能。
  * 管理 Webview 面板显示翻译结果，读取本地的 `webview/webview.html` 文件作为显示内容。

## 立即开始

1. **启动调试**：
   - 按下 `F5` 启动一个新的 VS Code 窗口以加载并调试扩展。
2. **运行命令**：
   - 在待翻译文件中选中一段文本，
   - 右键点击并选择“翻译为中文”命令开始翻译。
3. **调试与开发**：
   - 在 `extension.js` 中设置断点，观察控制台输出调试信息。
   - 当翻译过程中发生错误或超时，系统会弹窗提示错误信息。

## 修改代码

* 在修改 `extension.js` 后，可以直接使用调试工具栏的“重新启动”按钮重新加载扩展。
* 也可以重新加载（`Ctrl+R` 或 macOS 上的 `Cmd+R`）VS Code 窗口来应用更改。

## 探索 API

* 查看 `node_modules/@types/vscode/index.d.ts` 文件，了解更多 VS Code 扩展 API。
* 通过调试信息掌握如何处理流式响应、请求取消与超时逻辑。

## 运行测试

* 安装 [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)。
* 从活动栏打开 Testing 视图并点击 “Run Test” 按钮，或使用快捷键 `Ctrl/Cmd + ; A` 运行测试。
* 修改 `test/extension.test.js` 或在 `test` 文件夹中新建测试文件，测试文件需符合 `**.test.js` 的命名规则。

## 进一步探索

* [遵循 UX 指南](https://code.visualstudio.com/api/ux-guidelines/overview) 以创建与 VS Code 原生界面无缝集成的扩展。
* [发布扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) 到 VS Code 市场。
* 使用 [持续集成](https://code.visualstudio.com/api/working-with-extensions/continuous-integration) 自动构建并部署扩展。
* 整合 [反馈流程](https://code.visualstudio.com/api/get-started/wrapping-up#issue-reporting) 以便用户提交问题和建议。

---
享受你的编码与翻译之旅！