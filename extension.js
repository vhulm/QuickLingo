// @ts-check
const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} QuickLingoConfig
 * @property {string} apiKey - API密钥
 * @property {string} apiUrl - API基础URL
 * @property {string} modelName - 翻译模型名称
 * @property {boolean} enableStreaming - 是否启用流式输出
 * @property {string} webviewTitle - Webview面板标题
 * @property {string} extensionDisplayName - 扩展显示名称
 */

// #region 配置管理
/**
 * 配置管理类，负责获取和管理扩展配置
 */
class ConfigManager {
	/**
	 * 获取扩展配置
	 * @returns {QuickLingoConfig} 扩展配置对象
	 */
	static getConfig() {
		const configuration = vscode.workspace.getConfiguration('quicklingo');
		return {
			apiKey: configuration.get('apiKey', ''),
			apiUrl: configuration.get('apiUrl', 'https://api.openai.com/v1/chat/completions'),
			modelName: configuration.get('modelName', 'gpt-4o'),
			enableStreaming: configuration.get('enableStreaming', true),
			webviewTitle: '翻译结果',
			extensionDisplayName: 'QuickLingo',
		};
	}

	/**
	 * 验证配置的有效性
	 * @returns {boolean} 配置是否有效
	 */
	static validateConfig() {
		const { apiKey, apiUrl } = this.getConfig();
		return Boolean(apiKey && apiUrl);
	}
}
// #endregion 配置管理

// #region 日志和错误处理
/**
 * 日志和错误处理类，提供统一的日志记录和错误处理方法
 */
class Logger {
	/**
	 * 显示错误消息并可选择记录到控制台
	 * @param {string} message - 要显示的错误消息
	 * @param {Error} [error] - 错误对象（可选）
	 */
	static handleError(message, error) {
		const { extensionDisplayName } = ConfigManager.getConfig();
		vscode.window.showErrorMessage(`${extensionDisplayName}: ${message}`);
		if (error) {
			console.error(`${extensionDisplayName}: ${message}`, error);
		}
	}

	/**
	 * 记录信息性消息到控制台
	 * @param {string} message - 要记录的消息
	 */
	static info(message) {
		const { extensionDisplayName } = ConfigManager.getConfig();
		console.info(`${extensionDisplayName}: ${message}`);
	}

	/**
	 * 记录警告消息到控制台
	 * @param {string} message - 要记录的消息
	 */
	static warn(message) {
		const { extensionDisplayName } = ConfigManager.getConfig();
		console.warn(`${extensionDisplayName}: ${message}`);
	}

	/**
	 * 记录调试消息到控制台
	 * @param {string} message - 要记录的消息
	 */
	static debug(message) {
		const { extensionDisplayName } = ConfigManager.getConfig();
		console.debug(`${extensionDisplayName}: ${message}`);
	}
}
// #endregion 日志和错误处理

// #region 翻译服务
/**
 * 翻译服务类，处理与翻译API的交互
 */
class TranslationService {
	/**
	 * 构建翻译请求配置和数据
	 * @param {string} text - 要翻译的文本
	 * @param {AbortSignal} [signal] - axios请求信号
	 * @returns {{axiosConfig: import('axios').AxiosRequestConfig, requestData: Object}} 请求配置和数据
	 */
	buildRequest(text, signal) {
		const { apiKey, apiUrl, modelName, enableStreaming } = ConfigManager.getConfig();

		if (!apiKey) {
			throw new Error('未设置API密钥，请在设置中配置quicklingo.apiKey');
		}

		const requestData = {
			model: modelName,
			stream: enableStreaming,
			messages: [
				{
					role: "user",
					content: `请把下面内容翻译为中文：\n${text}`,
				},
			],
		};

		const axiosConfig = {
			method: 'post',
			url: apiUrl,
			headers: {
				'Accept': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			data: JSON.stringify(requestData),
		};

		// 如果流式处理，则设置响应类型
		if (enableStreaming) {
			axiosConfig.responseType = 'stream';
		}

		// 增加取消信号，支持用户取消和超时
		if (signal) {
			axiosConfig.signal = signal;
		}

		return { axiosConfig, requestData };
	}

	/**
	 * 处理流式翻译响应
	 * @param {any} streamData - axios流响应
	 * @param {vscode.WebviewPanel} panel - 用于显示结果的Webview面板
	 * @returns {Promise<void>} 处理完成的Promise
	 */
	handleStreamResponse(streamData, panel) {
		return new Promise((resolve, reject) => {
			let fullText = '';

			streamData.on('data', (chunk) => {
				try {
					const chunkText = chunk.toString();
					const lines = chunkText.split('\n');

					for (let line of lines) {
						line = line.trim();
						if (!line) continue;

						if (line.startsWith('data:')) {
							const dataStr = line.replace(/^data:\s*/, '');
							if (dataStr === '[DONE]') {
								continue;
							}

							try {
								const jsonData = JSON.parse(dataStr);
								const delta = jsonData.choices?.[0]?.delta?.content;

								if (delta) {
									fullText += delta;
									panel.webview.postMessage({ text: fullText, isComplete: false });
								}
							} catch (error) {
								Logger.debug(`解析流数据块时出错：${error.message}`);
								// 继续处理下一行，不中断整个流程
							}
						}
					}
				} catch (error) {
					Logger.debug(`处理流数据时出错：${error.message}`);
				}
			});

			streamData.on('end', () => {
				Logger.info('翻译流处理完成');
				panel.webview.postMessage({ text: fullText, isComplete: true });
				resolve();
			});

			streamData.on('error', (error) => {
				if (error.code === 'ERR_CANCELED') {
					Logger.info('翻译已取消或超时');
					reject(new Error('翻译已取消或超时'));
				} else {
					Logger.handleError('翻译流错误', error);
					panel.webview.postMessage({ text: '翻译失败，请稍候重试。', isError: true });
					reject(error);
				}
			});
		});
	}

	/**
	 * 流式翻译处理
	 * @param {string} text - 要翻译的文本
	 * @param {vscode.WebviewPanel} panel - Webview面板
	 * @param {AbortSignal} signal - 用于取消/超时的信号
	 * @returns {Promise<void>} 翻译完成的Promise
	 */
	async translateTextStreaming(text, panel, signal) {
		try {
			const { axiosConfig } = this.buildRequest(text, signal);
			const response = await axios(axiosConfig);
			await this.handleStreamResponse(response.data, panel);
		} catch (error) {
			if (error.code === 'ERR_CANCELED') {
				panel.webview.postMessage({ text: '翻译已取消或超时', isError: true });
				throw new Error('翻译已取消或超时');
			} else {
				Logger.handleError('流式翻译时出错', error);
				panel.webview.postMessage({ text: '翻译失败，请稍候重试。', isError: true });
				throw error;
			}
		}
	}

	/**
	 * 非流式翻译处理：一次性获取完整结果
	 * @param {string} text - 要翻译的文本
	 * @param {vscode.WebviewPanel} panel - Webview面板
	 * @param {AbortSignal} signal - 用于取消/超时的信号
	 * @returns {Promise<void>} 翻译完成的Promise
	 */
	async translateTextNonStreaming(text, panel, signal) {
		try {
			const { axiosConfig } = this.buildRequest(text, signal);
			const response = await axios(axiosConfig);

			let translatedText = '';
			if (response.data?.choices?.[0]?.message?.content) {
				translatedText = response.data.choices[0].message.content;
			}

			// 直接一次性展示所有翻译结果
			panel.webview.postMessage({ text: translatedText, isComplete: true });
		} catch (error) {
			if (error.code === 'ERR_CANCELED') {
				panel.webview.postMessage({ text: '翻译已取消或超时', isError: true });
				throw new Error('翻译已取消或超时');
			} else {
				Logger.handleError('非流式翻译时出错', error);
				panel.webview.postMessage({ text: '翻译失败，请稍候重试。', isError: true });
				throw error;
			}
		}
	}

	/**
	 * 根据配置判断使用流式或非流式处理
	 * @param {string} text - 要翻译的文本
	 * @param {vscode.WebviewPanel} panel - Webview面板
	 * @param {AbortSignal} signal - 用于取消/超时的信号
	 * @returns {Promise<void>} 翻译完成的Promise
	 */
	async translateToChinese(text, panel, signal) {
		// 输入验证
		if (!text || text.trim().length === 0) {
			panel.webview.postMessage({ text: '无内容可翻译', isError: true });
			throw new Error('无内容可翻译');
		}

		// 检查配置是否有效
		if (!ConfigManager.validateConfig()) {
			panel.webview.postMessage({
				text: '翻译配置无效，请检查设置中的API密钥和URL',
				isError: true
			});
			throw new Error('翻译配置无效');
		}

		const { enableStreaming } = ConfigManager.getConfig();
		panel.webview.postMessage({ text: '正在翻译...', isLoading: true });

		if (enableStreaming) {
			await this.translateTextStreaming(text, panel, signal);
		} else {
			await this.translateTextNonStreaming(text, panel, signal);
		}
	}
}
// #endregion 翻译服务

// #region Webview管理
/**
 * Webview管理类，负责创建和管理翻译结果的Webview面板
 */
class WebviewManager {
	/**
	 * 创建Webview管理器实例
	 * @param {string} extensionPath - 扩展根目录路径
	 */
	constructor(extensionPath) {
		this.panel = null;
		this.extensionPath = extensionPath;
		this.webviewPanelId = 'translationResult';
	}

	/**
	 * 创建或显示翻译Webview面板
	 * @returns {vscode.WebviewPanel} Webview面板
	 */
	createOrShowPanel() {
		// 如果已有面板，则直接显示
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.Beside);
			return this.panel;
		}

		const { webviewTitle } = ConfigManager.getConfig();

		// 创建新面板
		this.panel = vscode.window.createWebviewPanel(
			this.webviewPanelId,
			webviewTitle,
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.file(path.join(this.extensionPath, 'webview'))
				]
			}
		);

		// 设置HTML内容
		this.panel.webview.html = this.getWebviewContent();

		// 处理面板关闭事件
		this.panel.onDidDispose(() => {
			this.panel = null;
		}, null, []);

		return this.panel;
	}

	/**
	 * 读取webview.html并返回HTML字符串
	 * @returns {string} HTML内容
	 */
	getWebviewContent() {
		const htmlPath = path.join(this.extensionPath, 'webview', 'webview.html');
		try {
			const htmlContent = fs.readFileSync(htmlPath, 'utf8');
			return htmlContent;
		} catch (error) {
			Logger.handleError('读取Webview HTML文件时出错', error);
			const { webviewTitle } = ConfigManager.getConfig();

			// 返回一个基本的HTML作为后备
			return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${webviewTitle}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; padding: 20px; }
            h2 { color: #333; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h2>${webviewTitle}</h2>
          <p id="content">等待翻译内容...</p>
          <script>
            const vscode = acquireVsCodeApi();
            window.addEventListener('message', event => {
              const message = event.data;
              const contentElement = document.getElementById('content');
              if (message.text) {
                contentElement.textContent = message.text;
                if (message.isError) {
                  contentElement.className = 'error';
                } else {
                  contentElement.className = '';
                }
              }
            });
          </script>
        </body>
        </html>
      `;
		}
	}
}
// #endregion Webview管理

// #region 命令处理
/**
 * 命令处理类，处理扩展命令
 */
class CommandHandler {
	/**
	 * 创建命令处理器实例
	 * @param {WebviewManager} webviewManager - Webview管理器实例
	 * @param {TranslationService} translationService - 翻译服务实例
	 */
	constructor(webviewManager, translationService) {
		this.webviewManager = webviewManager;
		this.translationService = translationService;
		this.timeoutMs = 60000; // 60秒超时
	}

	/**
	 * 处理翻译命令
	 * @returns {Promise<void>} 命令处理完成的Promise
	 */
	async handleTranslateCommand() {
		// 检查编辑器和选中文本
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			Logger.handleError('未找到活动的编辑器窗口');
			return;
		}

		const selectedText = editor.document.getText(editor.selection);
		if (!selectedText) {
			Logger.handleError('请选择要翻译的文本');
			return;
		}

		// 创建或显示面板
		const panel = this.webviewManager.createOrShowPanel();

		// 使用VS Code的Progress API显示进度提示，同时允许用户取消操作
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: '正在翻译中...',
			cancellable: true,
		}, async (progress, token) => {
			// 创建一个AbortController用于取消请求
			const abortController = new AbortController();

			// 监听VS Code的取消事件，触发取消请求
			token.onCancellationRequested(() => {
				Logger.info('用户取消了翻译');
				abortController.abort();
			});

			try {
				// 设置超时
				const timeoutId = setTimeout(() => {
					abortController.abort();
					Logger.warn('翻译请求超时');
				}, this.timeoutMs);

				// 开始翻译
				await this.translationService.translateToChinese(selectedText, panel, abortController.signal);

				// 清除超时
				clearTimeout(timeoutId);
			} catch (error) {
				// 错误已在翻译服务内部处理
				Logger.debug(`翻译命令处理异常: ${error.message}`);
			}
		});
	}

	/**
	 * 注册命令到VS Code上下文
	 * @param {vscode.ExtensionContext} context - 扩展上下文
	 */
	registerCommands(context) {
		const translateCommand = vscode.commands.registerCommand(
			'quicklingo.translateToChinese',
			this.handleTranslateCommand.bind(this)
		);
		context.subscriptions.push(translateCommand);
	}
}
// #endregion 命令处理

// #region 扩展生命周期
/**
 * 扩展管理类，管理扩展的生命周期
 */
class ExtensionManager {
	/**
	 * 激活扩展
	 * @param {vscode.ExtensionContext} context - 扩展上下文
	 */
	static activate(context) {
		Logger.info('扩展 "quicklingo" 现在已激活！');

		try {
			// 初始化服务
			const webviewManager = new WebviewManager(context.extensionPath);
			const translationService = new TranslationService();
			const commandHandler = new CommandHandler(webviewManager, translationService);

			// 注册命令
			commandHandler.registerCommands(context);

			// 检查配置
			if (!ConfigManager.validateConfig()) {
				Logger.warn('扩展配置不完整，请检查设置');
				vscode.window.showWarningMessage('QuickLingo: 请在设置中配置API密钥以启用翻译功能');
			}
		} catch (error) {
			Logger.handleError('扩展激活时出错', error);
		}
	}

	/**
	 * 停用扩展
	 */
	static deactivate() {
		Logger.info('扩展 "quicklingo" 现在已停用！');
		// 清理资源
	}
}
// #endregion 扩展生命周期

module.exports = {
	activate: ExtensionManager.activate,
	deactivate: ExtensionManager.deactivate
};