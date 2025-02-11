// @ts-check
const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// #region 配置项与常量
/**
 * 通过 VS Code 设置获取扩展配置。
 * 需要先在 package.json 中的 contributes.configuration 部分声明下列配置项:
 *   quicklingo.apiKey
 *   quicklingo.apiUrl
 *   quicklingo.modelName
 *   quicklingo.enableStreaming
 */
function getConfig() {
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

const webviewPanelId = 'translationResult'; // Webview 面板的唯一 ID
// #endregion 配置项与常量

// #region 错误处理与日志记录
/**
 * 集中式错误处理函数。这使得在整个扩展中跟踪和处理错误更加一致。
 *
 * @param {string} message 要显示的错误消息。
 * @param {Error=} error 错误对象（可选）。
 */
function handleError(message, error) {
	const { extensionDisplayName } = getConfig();
	vscode.window.showErrorMessage(`${extensionDisplayName}: ${message}`);
	if (error) {
		console.error(`${extensionDisplayName}: ${message}`, error);
	}
}

/**
 * 将信息性消息记录到控制台。对于调试和跟踪扩展的行为很有用。
 *
 * @param {string} message 要记录的消息。
 */
function logInfo(message) {
	const { extensionDisplayName } = getConfig();
	console.info(`${extensionDisplayName}: ${message}`);
}
// #endregion 错误处理与日志记录

// #region 翻译服务

class TranslationService {
	/**
	 * 构建 axios 配置和请求数据
	 * @param {string} text 要翻译的文本
	 * @returns {{axiosConfig: import('axios').AxiosRequestConfig, requestData: Object}}
	 */
	buildRequest(text) {
		const { apiKey, apiUrl, modelName, enableStreaming } = getConfig();
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

		return { axiosConfig, requestData };
	}

	/**
	 * 处理流式翻译响应
	 * @param {any} streamData axios 流响应
	 * @param {vscode.WebviewPanel} panel 用于显示结果的 Webview 面板
	 */
	handleStreamResponse(streamData, panel) {
		let fullText = '';
		streamData.on('data', (chunk) => {
			const chunkText = chunk.toString();
			const lines = chunkText.split('\n');
			for (let line of lines) {
				line = line.trim();
				if (!line) continue;
				if (line.startsWith('data:')) {
					const dataStr = line.replace(/^data:\s*/, '');
					if (dataStr === '[DONE]') {
						return;
					}
					try {
						const jsonData = JSON.parse(dataStr);
						const delta = jsonData.choices &&
							jsonData.choices[0] &&
							jsonData.choices[0].delta &&
							jsonData.choices[0].delta.content;
						if (delta) {
							fullText += delta;
							panel.webview.postMessage({ text: fullText });
						}
					} catch (err) {
						console.error('解析流数据块时出错：', err);
					}
				}
			}
		});

		streamData.on('end', () => {
			logInfo('流已结束。');
		});

		streamData.on('error', (error) => {
			handleError('翻译流错误。', error);
			panel.webview.postMessage({ text: '翻译失败，请稍候重试.' });
		});
	}

	/**
	 * 流式翻译处理
	 * @param {string} text 要翻译的文本
	 * @param {vscode.WebviewPanel} panel Webview 面板
	 */
	async translateTextStreaming(text, panel) {
		const { axiosConfig } = this.buildRequest(text);
		try {
			const response = await axios(axiosConfig);
			this.handleStreamResponse(response.data, panel);
		} catch (error) {
			handleError('流式翻译时出错。', error);
			panel.webview.postMessage({ text: '翻译失败，请稍候重试.' });
		}
	}

	/**
	 * 非流式翻译处理：一次性获取完整结果
	 * @param {string} text 要翻译的文本
	 * @param {vscode.WebviewPanel} panel Webview 面板
	 */
	async translateTextNonStreaming(text, panel) {
		const { axiosConfig } = this.buildRequest(text);
		try {
			const response = await axios(axiosConfig);
			let fullText = '';
			if (
				response.data &&
				response.data.choices &&
				response.data.choices[0] &&
				response.data.choices[0].message &&
				response.data.choices[0].message.content
			) {
				fullText = response.data.choices[0].message.content;
			}
			// 直接一次性展示所有翻译结果
			panel.webview.postMessage({ text: fullText });
		} catch (error) {
			handleError('非流式翻译时出错。', error);
			panel.webview.postMessage({ text: '翻译失败，请稍候重试.' });
		}
	}

	/**
	 * 根据配置判断使用流式或非流式处理
	 * @param {string} text 要翻译的文本
	 * @param {vscode.WebviewPanel} panel Webview 面板
	 */
	async translateToChinese(text, panel) {
		const { enableStreaming } = getConfig();
		if (enableStreaming) {
			await this.translateTextStreaming(text, panel);
		} else {
			await this.translateTextNonStreaming(text, panel);
		}
	}
}

const translationService = new TranslationService();
// #endregion 翻译服务

// #region Webview 管理

/**
 * 管理翻译 Webview 面板。确保一次只打开一个面板，并提供一致的方式来更新其内容。
 */
class WebviewManager {
	/**
	 * 构造函数中传入扩展根目录路径，便于加载本地 HTML 文件。
	 * @param {string} extensionPath 扩展根目录路径
	 */
	constructor(extensionPath) {
		this.panel = null;
		this.extensionPath = extensionPath;
	}

	/**
	 * 创建或显示翻译 Webview 面板。
	 *
	 * @returns {vscode.WebviewPanel} Webview 面板。
	 */
	createOrShowPanel() {
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.Beside);
			return this.panel;
		}

		const { webviewTitle } = getConfig();
		this.panel = vscode.window.createWebviewPanel(
			webviewPanelId,
			webviewTitle,
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true // 保持隐藏时保留上下文
			}
		);

		this.panel.webview.html = this.getWebviewContent();

		this.panel.onDidDispose(() => {
			this.panel = null; // 关闭时重置面板
		}, null, null);

		return this.panel;
	}

	/**
	 * 读取 media 文件夹下的 webview.html 并返回 HTML 字符串。
	 *
	 * @returns {string} HTML 内容。
	 */
	getWebviewContent() {
		const htmlPath = path.join(this.extensionPath, 'webview', 'webview.html');
		try {
			return fs.readFileSync(htmlPath, 'utf8');
		} catch (error) {
			handleError('读取 Webview HTML 文件时出错。', error);
			const { webviewTitle } = getConfig();
			return `<html><body><h2>${webviewTitle}</h2><p>无法加载内容。</p></body></html>`;
		}
	}
}

let webviewManager;
// #endregion Webview 管理

// #region 命令处理

/**
 * 处理 'quicklingo.translateToChinese' 命令。
 */
async function handleTranslateCommand() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		handleError('未找到活动的编辑器窗口。');
		return;
	}

	const selectedText = editor.document.getText(editor.selection);
	if (!selectedText) {
		handleError('请选择要翻译的文本。');
		return;
	}

	const { extensionDisplayName } = getConfig();
	vscode.window.showInformationMessage(`${extensionDisplayName}: 正在翻译，请稍候...`);
	const panel = webviewManager.createOrShowPanel();
	await translationService.translateToChinese(selectedText, panel);
}
// #endregion 命令处理

// #region 扩展生命周期

/**
 * 在激活扩展时调用。
 *
 * @param {vscode.ExtensionContext} context 扩展上下文。
 */
function activate(context) {
	logInfo('扩展 "quicklingo" 现在已激活！');

	// 实例化 WebviewManager，并传入扩展根目录路径
	webviewManager = new WebviewManager(context.extensionPath);

	const translateCommand = vscode.commands.registerCommand('quicklingo.translateToChinese', handleTranslateCommand);
	context.subscriptions.push(translateCommand);
}

/**
 * 在停用扩展时调用。
 */
function deactivate() {
	logInfo('扩展 "quicklingo" 现在已停用！');
}
// #endregion 扩展生命周期

module.exports = {
	activate,
	deactivate,
};