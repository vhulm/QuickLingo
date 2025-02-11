# quicklingo - 快速翻译扩展

这是扩展 "quicklingo" 的自述文件，它能够在 VS Code 编辑器中通过右键菜单实现选中文本的翻译，将其转换为中文。该扩展依赖于大模型翻译服务，因此在使用前需要在 VS Code 设置中配置好 API 信息，包括 API 密钥和翻译服务的相关参数。

## 功能

- **右键翻译**：在文本编辑器中选中文本后，右键菜单中会显示“翻译为中文”的选项。
- **实时翻译预览**：翻译过程会在独立的 Webview 面板中实时显示，支持流式输出（根据配置决定是否启用）。
- **灵活配置**：通过设置 `quicklingo.apiKey`、`quicklingo.apiUrl`、`quicklingo.modelName` 以及 `quicklingo.enableStreaming` 进行个性化定制。
- **错误和超时处理**：扩展内置错误提示和超时管理，确保用户能得到友好的反馈消息。

## 要求

- 需要有效的翻译 API 访问权限（及相应的 API Key）。
- 依赖 VS Code 的扩展 API 以及 axios 库来处理 HTTP 请求。

## 扩展设置

此扩展贡献了以下配置项（请在 VS Code 的设置中进行配置）：

* `quicklingo.apiKey`: 访问翻译 API 的密钥。建议使用 VS Code 的钥匙串保护 API 密钥。
* `quicklingo.apiUrl`: 翻译 API 的基础 URL，默认值为 `https://api.openai.com/v1/chat/completions`。
* `quicklingo.modelName`: 用于翻译的模型名称，默认值为 `gpt-4o`。
* `quicklingo.enableStreaming`: 是否启用流式输出，默认为 `true`。部分模型不支持流式输出时，请设置为 `false` 以使用一次性返回方式。

## 已知问题

- 当 API 请求失败或超时时，Webview 面板会显示错误提示“翻译失败，请稍候重试。”
- 部分模型可能不支持流式传输，用户需要根据实际情况在设置中调整 `enableStreaming` 参数。

## 更新说明

### 1.0.0

- 初始发布：支持通过右键菜单翻译选中文本为中文。
- 实现了基于 axios 的 HTTP 请求和流式响应处理。

## 使用方法

1. **安装扩展**：安装后在 VS Code 中打开需要翻译的文件。
2. **配置 API 设置**：通过设置界面配置 `quicklingo.apiKey`、`quicklingo.apiUrl`、`quicklingo.modelName` 及 `quicklingo.enableStreaming`。
3. **执行翻译**：选中需要翻译的文本，右键选择“翻译为中文”命令，查看翻译结果在侧边的 Webview 面板中显示。

## 调试与开发

- **分屏编辑**：使用 `Ctrl+\` (Windows/Linux) 或 `Cmd+\` (macOS) 进行分屏编辑。
- **切换预览**：使用 `Shift+Ctrl+V` (Windows/Linux) 或 `Shift+Cmd+V` (macOS) 实时预览 Markdown 内容。
- **调试扩展**：按下 `F5` 启动调试窗口，设置断点调试代码。
- **更多信息**：请参阅 [Visual Studio Code 的官方文档](https://code.visualstudio.com/docs) 获取更多帮助。

**祝您使用愉快！**