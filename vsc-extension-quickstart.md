# 欢迎使用你的 VS Code 扩展

## 文件夹中的内容

* 此文件夹包含了你的扩展所需的所有文件。
* `package.json` - 这是清单文件，在其中你声明了你的扩展和命令。
  * 示例插件注册了一个命令并定义了它的标题和命令名称。通过这些信息，VS Code 可以在命令面板中显示该命令，而无需先加载插件。
* `extension.js` - 这是你为实现命令提供逻辑的主要文件。
  * 该文件导出了一个函数 `activate`，当你的扩展第一次被激活（在这里是通过执行命令来激活）时会调用该函数。在 `activate` 函数内部，我们调用了 `registerCommand`。
  * 我们将包含命令实现的函数作为第二个参数传递给 `registerCommand`。

## 立即开始

* 按下 `F5` 打开一个加载了你扩展的新窗口。
* 通过按下 (`Ctrl+Shift+P` 或 Mac 上的 `Cmd+Shift+P`) 并输入 `Hello World` 来从命令面板运行你的命令。
* 在 `extension.js` 中设置断点以调试你的扩展。
* 在调试控制台中查看你的扩展输出的信息。

## 修改代码

* 在修改 `extension.js` 中的代码后，你可以从调试工具栏重新启动扩展。
* 你也可以重新加载（`Ctrl+R` 或 Mac 上的 `Cmd+R`） VS Code 窗口以加载你的更改。

## 探索 API

* 当你打开 `node_modules/@types/vscode/index.d.ts` 文件时，你可以查看我们完整的 API 集合。

## 运行测试

* 安装 [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
* 从活动栏打开 Testing 视图并点击 “Run Test” 按钮，或使用快捷键 `Ctrl/Cmd + ; A`
* 查看测试结果在 Test Results 视图中的输出。
* 修改 `test/extension.test.js` 中的代码或在 `test` 文件夹中创建新的测试文件。
  * 提供的测试运行器只会考虑名称模式匹配 `**.test.js` 的文件。
  * 你可以在 `test` 文件夹中创建子文件夹，以任意方式结构化你的测试。

## 进一步探索

* [遵循 UX 指南](https://code.visualstudio.com/api/ux-guidelines/overview) 以创建与 VS Code 原生界面和模式无缝集成的扩展。
* [发布你的扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) 到 VS Code 扩展市场。
* 通过设置 [持续集成](https://code.visualstudio.com/api/working-with-extensions/continuous-integration) 来实现自动构建。
* 集成到 [报告问题](https://code.visualstudio.com/api/get-started/wrapping-up#issue-reporting) 流程中，以便用户报告问题和功能请求。