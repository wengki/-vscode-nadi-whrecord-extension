/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const vscode = __webpack_require__(2);
const integrator_1 = __webpack_require__(3);
const command_handler_1 = __webpack_require__(4);
const sidebar_provider_1 = __webpack_require__(6);
const content_provider_1 = __webpack_require__(17);
const uri_service_1 = __webpack_require__(16);
class IntegratorFactory {
    constructor(extensionContext) {
        this._extensionContext = extensionContext;
    }
    create() {
        return new integrator_1.default({
            vscode,
            command: this._getCommand(),
            sidebar: this._getSidebar(),
            contentProvider: this._getContentProvider(),
            context: this._extensionContext
        });
    }
    _getCommand() {
        this._command = this._command || this._createCommand();
        return this._command;
    }
    _createCommand() {
        return new command_handler_1.default({
            vscode,
            extensionContext: this._extensionContext
        });
    }
    _getSidebar() {
        this._sidebar = this._sidebar || this._createSidebar();
        return this._sidebar;
    }
    _createSidebar() {
        return new sidebar_provider_1.SidebarProvider(this._extensionContext.extensionUri, this._extensionContext);
    }
    _getContentProvider() {
        this._contentProvider = this._contentProvider || this._createContentProvider();
        return this._contentProvider;
    }
    _createContentProvider() {
        return new content_provider_1.default({ uriService: this._getUriService() });
    }
    _getUriService() {
        this._uriService = this._uriService || this._createUriService();
        return this._uriService;
    }
    _createUriService() {
        return new uri_service_1.UriService({
            Uri: vscode.Uri,
            getCurrentDateFn: () => Date.now()
        });
    }
}
exports["default"] = IntegratorFactory;


/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const watch_project_service_1 = __webpack_require__(19);
const constant = __webpack_require__(5);
const property_check_1 = __webpack_require__(22);
class Integrator {
    constructor(params) {
        this._vscode = params.vscode;
        this._commandHandler = params.command;
        this._sidebar = params.sidebar;
        this._contentProvider = params.contentProvider;
        this._extensionContext = params.context;
    }
    integrate(context) {
        this._registerCommands(context);
        this._registerWindowProviders(context);
        this._registerProviders(context);
        this._projectFolderWatch();
    }
    _registerCommands(context) {
        this._getCommands().forEach(command => {
            const handler = command.handler;
            const disposable = this._vscode.commands[command.registrar](`${constant.EXTENSION_NAME}.${command.name}`, handler.execute.bind(handler, command.name));
            context.subscriptions.push(disposable);
        });
    }
    _registerProviders(context) {
        const disposable = this._vscode.workspace.registerTextDocumentContentProvider(constant.EXTENSION_NAME, this._contentProvider);
        context.subscriptions.push(disposable);
    }
    _registerWindowProviders(context) {
        this._getWindows().forEach(win => {
            const window = this._vscode.window[win.registrar](win.name, win.handler);
            context.subscriptions.push(window);
        });
    }
    _getCommands() {
        return [
            {
                name: 'create-folder',
                registrar: 'registerCommand',
                handler: this._commandHandler
            },
            {
                name: 'create-file',
                registrar: 'registerCommand',
                handler: this._commandHandler
            },
        ];
    }
    _getWindows() {
        return [
            {
                name: 'nadi-sidebar',
                registrar: 'registerWebviewViewProvider',
                handler: this._sidebar
            },
        ];
    }
    _projectFolderWatch() {
        (0, property_check_1.propertyChek)();
        const projectFolderWatch = new watch_project_service_1.WatchWorkingDirectory({ context: this._extensionContext, sidebar: this._sidebar });
        projectFolderWatch.getFilesOnTabs();
        projectFolderWatch.run();
    }
}
exports["default"] = Integrator;


/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const make_directory_file_1 = __webpack_require__(9);
class CommandHandler {
    constructor(params) {
        this._vscode = params.vscode;
    }
    execute(name) {
        const workingFolder = this._vscode.Uri.parse(this._vscode.workspace.workspaceFolders[0].uri.path);
        const makeFile = new make_directory_file_1.MakeFile();
        switch (name) {
            case 'create-folder':
                return makeFile.createFileOrFolder('folder', workingFolder ? makeFile.findDir(workingFolder.fsPath) : '/');
            case 'create-file':
                return makeFile.createFileOrFolder('file', workingFolder ? makeFile.findDir(workingFolder.fsPath) : '/');
            default:
                return;
        }
    }
}
exports["default"] = CommandHandler;


/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EXTENSION_NAME = void 0;
exports.EXTENSION_NAME = 'nadi';


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SidebarProvider = void 0;
const vscode = __webpack_require__(2);
const getNonce_1 = __webpack_require__(10);
const working_files_history_provider_1 = __webpack_require__(11);
const working_history_files_1 = __webpack_require__(13);
class SidebarProvider {
    constructor(_extensionUri, context) {
        this._extensionUri = _extensionUri;
        this.context = context;
    }
    _historyWorkData() {
        return new working_history_files_1.WorkingHistoryFiles();
    }
    async eventDataChange() {
        const monthList = await this._historyWorkData().getHistoryByMonth();
        if (this._view) {
            this._view.webview.postMessage({
                type: 'onHistoryChange',
                value: monthList
            });
        }
    }
    async resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case "onInfo": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case "onError": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
                case "onRunDeveloperTool": {
                    vscode.commands.executeCommand("workbench.action.webview.openDeveloperTools");
                    break;
                }
                case "onOpenWorkingFilesHistory": {
                    working_files_history_provider_1.WorkingFilesHistoryTab.kill();
                    working_files_history_provider_1.WorkingFilesHistoryTab.createOrShow(this._extensionUri, data.value);
                    break;
                }
                case "getHistoryOfMonth": {
                    const list = await this._historyWorkData().getHistoryDatesByMonth(data.value);
                    // console.log(list);
                    webviewView.webview.postMessage({
                        type: 'getHistoryOfMonth',
                        value: {
                            key: data.value,
                            list: list
                        }
                    });
                    break;
                }
            }
        });
    }
    revive(panel) {
        this._view = panel;
    }
    async _getHtmlForWebview(webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "out", "compiled/Sidebar.js"));
        const stylesPathNadiCss = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "nadi-extension.css"));
        const nonce = (0, getNonce_1.getNonce)();
        const initHistoryList = await this._historyWorkData().getHistoryByMonth();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <link href="${stylesPathNadiCss}" rel="stylesheet">
                <script nonce="${nonce}">
                    const nadivscode = acquireVsCodeApi();
                    const initHistoryList = ${JSON.stringify(initHistoryList)}
                </script>
            </head>
            <body>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}
exports.SidebarProvider = SidebarProvider;


/***/ }),
/* 7 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 8 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 9 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MakeFile = void 0;
const vscode = __webpack_require__(2);
const fs = __webpack_require__(7);
const path = __webpack_require__(8);
class MakeFile {
    createFileOrFolder(taskType, relativePath) {
        relativePath = relativePath || '/';
        if (vscode.workspace.workspaceFolders !== undefined) {
            const projectRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            if (path.resolve(relativePath) === relativePath) {
                relativePath = relativePath.substring(projectRoot.length).replace(/\\/g, "/");
            }
            if (!relativePath.endsWith("/")) {
                relativePath += '/';
            }
            const basepath = projectRoot;
            vscode.window.showInputBox({
                value: relativePath || '/',
                prompt: `Create New ${taskType} (/path/subpath/to/${taskType})`,
                ignoreFocusOut: true,
                valueSelection: [-1, -1]
            }).then((fullpath) => {
                if (!fullpath) {
                    return;
                }
                try {
                    let paths = fullpath.split('>').map(e => e.trim());
                    let targetpath = taskType === 'file' ? path.dirname(paths[0]) : paths[0];
                    paths[0] = taskType === 'file' ? path.basename(paths[0]) : '/';
                    targetpath = path.join(basepath, targetpath);
                    paths = paths.map(e => path.join(targetpath, e));
                    if (taskType === 'file') {
                        this.makefiles(paths);
                    }
                    else {
                        this.makefolders(paths);
                    }
                    setTimeout(() => {
                        if (taskType === 'file') {
                            let openPath = paths.find(path => fs.lstatSync(path).isFile());
                            if (!openPath) {
                                return;
                            }
                            vscode.workspace.openTextDocument(openPath)
                                .then((editor) => {
                                if (!editor) {
                                    return;
                                }
                                vscode.window.showTextDocument(editor);
                            });
                        }
                    }, 50);
                }
                catch (error) {
                    this.logError(error);
                    vscode.window.showErrorMessage("Somthing went wrong! Please report on GitHub");
                }
            });
        }
    }
    makefiles(filepaths) {
        filepaths.forEach(filepath => this.makeFileSync(filepath));
    }
    makefolders(files) {
        files.forEach(file => this.makeDirSync(file));
    }
    makeDirSync(dir) {
        if (fs.existsSync(dir)) {
            return;
        }
        if (!fs.existsSync(path.dirname(dir))) {
            this.makeDirSync(path.dirname(dir));
        }
        fs.mkdirSync(dir);
    }
    makeFileSync(filename) {
        if (!fs.existsSync(filename)) {
            this.makeDirSync(path.dirname(filename));
            fs.createWriteStream(filename).close();
        }
    }
    findDir(filePath) {
        if (!filePath) {
            return null;
        }
        if (fs.statSync(filePath).isFile()) {
            return path.dirname(filePath);
        }
        return filePath;
    }
    logError(error) {
        console.log("==============Error===============");
        console.log(error);
        console.log("===================================");
    }
}
exports.MakeFile = MakeFile;


/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getNonce = void 0;
function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
exports.getNonce = getNonce;


/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WorkingFilesHistoryTab = void 0;
const path = __webpack_require__(8);
const vscode = __webpack_require__(2);
const getNonce_1 = __webpack_require__(10);
const config_1 = __webpack_require__(14);
const working_history_files_1 = __webpack_require__(13);
class WorkingFilesHistoryTab {
    constructor(panel, extensionUri, targetFolder) {
        this._disposables = [];
        this.workingHistoryFiles = new working_history_files_1.WorkingHistoryFiles();
        this._panel = panel;
        this._extensionUri = extensionUri;
        if (targetFolder !== undefined) {
            this.targetFolder = targetFolder;
        }
        // Set the webview's initial html content
        this._update();
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage((message) => {
            switch (message.type) {
                case "alert":
                    vscode.window.showErrorMessage(message.text);
                    return;
                case "getHistoryCollections": {
                    if (!message.value) {
                        return;
                    }
                    const histCol = this.workingHistoryFiles.readHistoryCollections(message.value);
                    // console.log(data.value);
                    this._panel.webview.postMessage({
                        type: 'receiveHistoryCollections',
                        value: histCol
                    });
                    break;
                }
                case "seeHistoryFileDiff":
                    this.workingHistoryFiles.takeHistoryDiff(message.value);
                    break;
            }
        }, null, this._disposables);
    }
    static createOrShow(extensionUri, targetFolder) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we already have a panel, show it.
        if (WorkingFilesHistoryTab.currentPanel) {
            WorkingFilesHistoryTab.currentPanel._panel.reveal(column);
            WorkingFilesHistoryTab.currentPanel._update();
            return;
        }
        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(WorkingFilesHistoryTab.viewType, "Working History", column || vscode.ViewColumn.One, {
            // Enable javascript in the webview
            enableScripts: true,
            // And restrict the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "media"),
                vscode.Uri.joinPath(extensionUri, "out/compiled"),
            ],
        });
        WorkingFilesHistoryTab.currentPanel = new WorkingFilesHistoryTab(panel, extensionUri, targetFolder);
    }
    static kill() {
        WorkingFilesHistoryTab.currentPanel?.dispose();
        WorkingFilesHistoryTab.currentPanel = undefined;
    }
    static revive(panel, extensionUri) {
        WorkingFilesHistoryTab.currentPanel = new WorkingFilesHistoryTab(panel, extensionUri);
    }
    dispose() {
        console.log('NADI History tab closed');
        WorkingFilesHistoryTab.currentPanel = undefined;
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    async _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
        webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case "onInfo": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case "onError": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
            }
        });
    }
    _getHistoryList() {
        if (this.targetFolder !== undefined) {
            return this.workingHistoryFiles.readHistoryCollections(path.join(config_1.config.localDirectory, 'history', this.targetFolder));
        }
        else {
            return this.workingHistoryFiles.readHistoryFolder();
        }
    }
    _getTargetFolderData() {
        if (this.targetFolder !== undefined) {
            return {
                date: this.workingHistoryFiles.convertTimeToDate(this.targetFolder),
                key: this.targetFolder
            };
        }
        else {
            return {};
        }
    }
    _getHtmlForWebview(webview) {
        const styleResetPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "reset.css"));
        const stylesPathMainPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css"));
        const stylesPathNadiCss = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "nadi-extension.css"));
        const scriptMn = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "out/compiled", "WorkingFilesHistoryTab.js"));
        // Use a nonce to only allow specific scripts to be run
        const nonce = (0, getNonce_1.getNonce)();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
        -->
        <meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetPath}" rel="stylesheet">
        <link href="${stylesPathMainPath}" rel="stylesheet">
        <link href="${stylesPathNadiCss}" rel="stylesheet">
        <script nonce="${nonce}">
            const nadivscode = acquireVsCodeApi();
            const workFilesHistory = ${JSON.stringify(this._getHistoryList())};
            const targetFolderData = ${JSON.stringify(this._getTargetFolderData())}
        </script>
			</head>
      <body>
      </body>
      <script src="${scriptMn}" nonce="${nonce}"></script>
	</html>`;
    }
}
exports.WorkingFilesHistoryTab = WorkingFilesHistoryTab;
WorkingFilesHistoryTab.viewType = "nadi-web-admin";


/***/ }),
/* 12 */,
/* 13 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WorkingHistoryFiles = void 0;
const fs = __webpack_require__(7);
const path = __webpack_require__(8);
const config_1 = __webpack_require__(14);
const diff_presenter_1 = __webpack_require__(15);
class WorkingHistoryFiles {
    constructor() {
        this.diffPresenter = new diff_presenter_1.default();
        this.historyDirectoryFullpath = path.join(config_1.config.localDirectory, '/history');
    }
    convertTimeToDate(timestamp, type) {
        var month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        var monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dirnameToDate = new Date(parseInt(timestamp));
        var dd = String(dirnameToDate.getDate()).padStart(2, '0');
        var m = String(dirnameToDate.getMonth() + 1).padStart(2, '0');
        var mm = monthShort[dirnameToDate.getMonth()];
        var mmm = month[dirnameToDate.getMonth()];
        var yyyy = dirnameToDate.getFullYear();
        // return`${yyyy}-${mm}-${dd}`;
        switch (type) {
            case 'short':
                return `${mm} ${dd}, ${yyyy}`;
            case 'monthYear':
                return `${mmm} ${yyyy}`;
            case 'monthYearNumber':
                return `${yyyy}${m}`;
            default:
                return `${mmm} ${dd}, ${yyyy}`;
        }
    }
    readHistoryFolder() {
        let histDBList = [];
        const historyDirectory = fs.readdirSync(this.historyDirectoryFullpath, { withFileTypes: true });
        historyDirectory.forEach((dir) => {
            const historyMemberFullpath = path.join(this.historyDirectoryFullpath, dir.name);
            if (fs.statSync(historyMemberFullpath).isDirectory()) {
                const historyCollection = fs.readdirSync(historyMemberFullpath, { withFileTypes: true });
                const convertNameDt = this.convertTimeToDate(dir.name);
                histDBList.push({
                    dirname: dir.name,
                    text: convertNameDt,
                    path: historyMemberFullpath,
                    collections: historyCollection
                });
            }
        });
        return histDBList;
    }
    readHistoryCollections(fullPath) {
        let list = [];
        if (fs.statSync(fullPath).isDirectory()) {
            const collections = fs.readdirSync(fullPath, { withFileTypes: true });
            collections.forEach((file) => {
                let collectionFileFullPath = path.join(fullPath, file.name);
                if (fs.statSync(collectionFileFullPath).isFile()) {
                    let dataContent = fs.readFileSync(collectionFileFullPath, { encoding: 'utf-8' });
                    dataContent = JSON.parse(dataContent);
                    list.push(Object.assign(dataContent, { index: path.basename(collectionFileFullPath, '.json') }));
                }
            });
            // console.log(list);
        }
        return { [path.basename(fullPath)]: list };
    }
    async getHistoryByMonth() {
        let list = {};
        if (fs.statSync(this.historyDirectoryFullpath).isDirectory()) {
            const allList = await fs.readdirSync(this.historyDirectoryFullpath, { withFileTypes: true });
            allList.forEach((dir) => {
                const yrMonth = this.convertTimeToDate(dir.name, 'monthYear');
                const yrMonthNum = this.convertTimeToDate(dir.name, 'monthYearNumber');
                if (!list.hasOwnProperty(yrMonthNum)) {
                    Object.assign(list, {
                        [yrMonthNum]: {
                            text: yrMonth,
                            count: 1
                        }
                    });
                }
                else {
                    const item = list[yrMonthNum];
                    Object.assign(list, {
                        [yrMonthNum]: {
                            text: yrMonth,
                            count: item.count + 1
                        }
                    });
                }
            });
        }
        return list;
    }
    async getHistoryDatesByMonth(yearMonthNumber) {
        let list = [];
        if (fs.statSync(this.historyDirectoryFullpath).isDirectory()) {
            const allList = await fs.readdirSync(this.historyDirectoryFullpath, { withFileTypes: true });
            allList.forEach((dir) => {
                const date = this.convertTimeToDate(dir.name);
                const yrMonthNum = this.convertTimeToDate(dir.name, 'monthYearNumber');
                const lastChangeHistDir = path.join(this.historyDirectoryFullpath, dir.name, 'last');
                let count = 0;
                if (fs.existsSync(lastChangeHistDir)) {
                    const dirMember = fs.readdirSync(lastChangeHistDir);
                    count = dirMember.length;
                }
                if (yearMonthNumber === yrMonthNum) {
                    list.push({
                        text: date,
                        dirname: dir.name,
                        count: count
                    });
                }
            });
        }
        return list;
    }
    async takeHistoryDiff(historyItem) {
        // console.log(historyItem);
        const historyDir = path.join(config_1.config.localDirectory, '/history');
        const dataParentDir = path.join(historyDir, historyItem.dirname);
        const originFx = path.join(dataParentDir, '/origin', historyItem.index);
        const lastFx = path.join(dataParentDir, '/last', historyItem.index);
        // console.log('originFx, lastFx', originFx, lastFx);
        // if(!fs.existsSync(originFx)){
        //     vscode.window.showErrorMessage(`The origin file of ${historyItem.rpath} of ${this.convertTimeToDate(historyItem.dirname)},  is unvailable!`);
        //     return;
        // }
        // if(!fs.existsSync(lastFx)){
        //     vscode.window.showErrorMessage(`The last changed file  file of ${historyItem.rpath} of ${this.convertTimeToDate(historyItem.dirname)} is unvailable!`);
        //     return;
        // }
        let date = this.convertTimeToDate(historyItem.dirname, 'short');
        await this.diffPresenter.takeDiff(originFx, lastFx, date, historyItem.rpath);
    }
}
exports.WorkingHistoryFiles = WorkingHistoryFiles;


/***/ }),
/* 14 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.config = void 0;
const vscode = __webpack_require__(2);
const path = __webpack_require__(8);
var configData = {
    workingDirectory: null,
    localDirectory: '/.nadi',
    gitIgnore: '/.gitignore',
};
if (vscode.workspace.workspaceFolders !== undefined) {
    configData.workingDirectory = vscode.workspace.workspaceFolders[0].uri.path;
    configData.localDirectory = path.join(configData.workingDirectory, configData.localDirectory);
    configData.gitIgnore = path.join(configData.workingDirectory, configData.gitIgnore);
}
else {
    configData.workingDirectory = '';
    configData.localDirectory = '';
    configData.gitIgnore = '';
}
exports.config = configData;


/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const vscode = __webpack_require__(2);
const uri_service_1 = __webpack_require__(16);
const path = __webpack_require__(8);
class DiffPresenter {
    constructor() {
        this.extensionScheme = 'partialdiff';
        this.diffModeSymbols = {
            normalised: '\u007e',
            asIs: '\u2194'
        };
        this.commands = vscode.commands;
        this._uriService = new uri_service_1.UriService({
            Uri: vscode.Uri,
            getCurrentDateFn: Date
        });
    }
    buildTitle(date, exactPath) {
        // return `${exactPath} ${this.diffModeSymbols.normalised} ${date}`;
        return `[${date}]: ${exactPath}`;
    }
    async takeDiff(uri1, uri2, date, exactPath) {
        const title = this.buildTitle(date, exactPath);
        const ext = path.extname(exactPath);
        const uriBefore = this._uriService.encodeShowFileAction({ path: uri1 + ext });
        const uriAfter = this._uriService.encodeShowFileAction({ path: uri2 + ext });
        return this.commands.executeCommand('vscode.diff', uriBefore, uriAfter, title, {
            column: vscode.ViewColumn.Active
        });
    }
}
exports["default"] = DiffPresenter;


/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UriService = void 0;
const constant = __webpack_require__(5);
const path = __webpack_require__(8);
const querystring = __webpack_require__(18);
class UriService {
    constructor(params) {
        this._Uri = params.Uri;
        this._getCurrentDate = params.getCurrentDateFn;
    }
    convertToAnnotateFileAction(uri) {
        const queryParams = this._getQueryParams(uri);
        return queryParams ?
            this._Uri.parse(`${constant.EXTENSION_NAME}:annotate-file?${querystring.stringify(queryParams)}`) :
            null;
    }
    _getQueryParams(uri) {
        if (uri.scheme === 'file') {
            return {
                path: uri.fsPath,
                _ts: this._getCurrentDate()
            };
        }
        if (uri.scheme === constant.EXTENSION_NAME && this.getAction(uri) === 'takediff') {
            const queryObject = querystring.parse(uri.query);
            if (!queryObject.previousCommitHash || !queryObject.previousPath)
                return null;
            return {
                path: queryObject.previousPath,
                commitHash: queryObject.previousCommitHash,
                repositoryRoot: queryObject.repositoryRoot
            };
        }
        throw new Error('Annotation cannot be given for this editor contents');
    }
    getAction(uri) {
        return uri.scheme === constant.EXTENSION_NAME ? uri.path.split('/')[0] : null;
    }
    encodeShowFileAction(params) {
        const encodedParams = querystring.stringify(params);
        // Need filename in the path so that editor can understand filetype
        // console.log(params.path);
        const uriPath = 'takediff' + (params.path ? `/${path.basename(params.path)}` : '');
        // const uriPath = 'takediff';
        return this._Uri.parse(`${constant.EXTENSION_NAME}:${uriPath}?${encodedParams}`);
    }
}
exports.UriService = UriService;


/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const fs = __webpack_require__(7);
const path = __webpack_require__(8);
const querystring = __webpack_require__(18);
class ContentProvider {
    constructor(params) {
        this._uriService = params.uriService;
    }
    provideTextDocumentContent(uri) {
        const action = this._uriService.getAction(uri);
        switch (action) {
            case 'takediff':
                return this._getFileContents(uri);
            default:
                // return Promise.reject(new Error('Unknown action'));
                break;
        }
    }
    _getFileContents(uri) {
        const params = querystring.parse(uri.query);
        if (!params.path) {
            return Promise.resolve('');
        }
        let fPath = params.path;
        const dir = path.dirname(fPath);
        const ext = path.extname(fPath);
        fPath = path.join(dir, path.basename(fPath, ext));
        console.log('fPath', fPath);
        return fs.readFileSync(fPath, {
            encoding: 'utf-8',
        });
    }
}
exports["default"] = ContentProvider;


/***/ }),
/* 18 */
/***/ ((module) => {

module.exports = require("querystring");

/***/ }),
/* 19 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WatchWorkingDirectory = void 0;
;
const vscode = __webpack_require__(2);
const fs = __webpack_require__(7);
const path = __webpack_require__(8);
const config_1 = __webpack_require__(14);
const md5_1 = __webpack_require__(20);
const make_directory_file_1 = __webpack_require__(9);
class WatchWorkingDirectory {
    constructor(params) {
        this.workingFiles = {};
        this.historyDirectory = path.join(config_1.config.localDirectory, '/history');
        this.makeFile = new make_directory_file_1.MakeFile();
        this.context = params.context;
        this.sidebar = params.sidebar;
    }
    getFilesOnTabs() {
        for (let tabGroup of vscode.window.tabGroups.all) {
            const activeTab = tabGroup.activeTab?.input;
            if (activeTab.hasOwnProperty('uri')) {
                this.readFileChange(activeTab.uri.fsPath, 'open');
            }
            const inactiveOpenedTab = tabGroup.tabs;
            inactiveOpenedTab.forEach((tab) => {
                const tbInput = tab.input;
                if (tbInput.hasOwnProperty('uri')) {
                    this.readFileChange(tbInput.uri.fsPath, 'open');
                }
            });
        }
    }
    checkIfContentChanges(md5FileName, md5Content, fullPath, content) {
        if (!this.workingFiles.hasOwnProperty(md5FileName)) {
            Object.assign(this.workingFiles, {
                [md5FileName]: md5Content
            });
            this.storeDBOriginalFile(md5FileName, content);
            return false;
        }
        else {
            const tmpDataFile = this.workingFiles[md5FileName];
            if (tmpDataFile === md5Content) {
                return false;
            }
            else {
                return true;
            }
        }
    }
    readFileChange(fullPath, event) {
        const md5FileName = (0, md5_1.md5)(fullPath);
        fs.readFile(fullPath, { encoding: 'utf8', flag: 'r' }, (err, content) => {
            if (err) {
                return;
            }
            const md5Content = (0, md5_1.md5)(content);
            const isSaveFileData = this.checkIfContentChanges(md5FileName, md5Content, fullPath, content);
            if (isSaveFileData || event === 'rename') {
                this.storeDBFile({
                    md5FileName: md5FileName,
                    event: event,
                    path: fullPath,
                    content: content
                });
                this.fireEventDataChange();
            }
        });
    }
    getTodayHistoryFolderName() {
        const dt = new Date();
        const timeFolder = dt.setHours(0o0, 0o0, 0o0, 0o00);
        return path.join(this.historyDirectory, `/${timeFolder.toString()}`);
    }
    storeDBOriginalFile(md5FileName, content) {
        const todayHistoryStorage = this.getTodayHistoryFolderName();
        const historyFileName = path.join(todayHistoryStorage, `/origin/${md5FileName}`);
        if (!fs.existsSync(path.dirname(historyFileName))) {
            this.makeFile.makeDirSync(path.dirname(historyFileName));
        }
        if (!fs.existsSync(historyFileName)) {
            fs.writeFileSync(historyFileName, content);
        }
    }
    storeDBFile(fileData) {
        const todayHistoryStorage = this.getTodayHistoryFolderName();
        const historyFileName = path.join(todayHistoryStorage, `/${fileData.md5FileName}.json`);
        const cuurenContentFileName = path.join(todayHistoryStorage, `/last/${fileData.md5FileName}`);
        if (!fs.existsSync(path.dirname(historyFileName))) {
            this.makeFile.makeDirSync(path.dirname(historyFileName));
        }
        if (!fs.existsSync(path.dirname(cuurenContentFileName))) {
            this.makeFile.makeDirSync(path.dirname(cuurenContentFileName));
        }
        let histData = {};
        if (fs.existsSync(historyFileName)) {
            const existData = fs.readFileSync(historyFileName, { encoding: 'utf-8' });
            histData = JSON.parse(existData);
        }
        histData = Object.assign(histData, {
            [fileData.event]: new Date().getTime(),
            'rpath': fileData.path.replace(config_1.config.workingDirectory ? config_1.config.workingDirectory + '/' : '', ''),
        });
        fs.writeFileSync(historyFileName, JSON.stringify(histData));
        fs.writeFileSync(cuurenContentFileName, fileData.content);
    }
    fireEventDataChange() {
        if (this.sidebar.eventDataChange !== undefined) {
            this.sidebar.eventDataChange();
        }
    }
    run() {
        try {
            if (config_1.config.workingDirectory) {
                const workingDir = config_1.config.workingDirectory;
                const $this = this;
                fs.watch(workingDir, { persistent: true, recursive: true }, function (event, fileName) {
                    let fullPath = path.join(workingDir, fileName);
                    if (fileName.startsWith('.nadi')) {
                        return;
                    }
                    $this.readFileChange(fullPath, event);
                });
            }
        }
        catch (error) {
            console.log('ERROR: ', error);
        }
    }
}
exports.WatchWorkingDirectory = WatchWorkingDirectory;


/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.md5 = void 0;
const crypto = __webpack_require__(21);
const md5 = (contents) => crypto.createHash('md5').update(contents).digest("hex");
exports.md5 = md5;


/***/ }),
/* 21 */
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),
/* 22 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.propertyChek = void 0;
const fs = __webpack_require__(7);
const path = __webpack_require__(8);
const config_1 = __webpack_require__(14);
function propertyChek() {
    if (config_1.config.workingDirectory) {
        const workingDirectory = config_1.config.workingDirectory;
        const nadiExtensionDir = path.join(workingDirectory, '/.nadi');
        const gitIgnoreFx = path.join(workingDirectory, '/.gitignore');
        if (!fs.existsSync(nadiExtensionDir)) {
            fs.mkdirSync(nadiExtensionDir);
        }
        if (fs.existsSync(gitIgnoreFx)) {
            // add '.nadi' to '.gitignore'
            fs.readFile(gitIgnoreFx, 'utf-8', (err, data) => {
                if (err) {
                    console.log(err);
                    return;
                }
                let dataArray = data.split('\n');
                // check '.nadi' if not exist then add
                if (!dataArray.includes('.nadi')) {
                    fs.appendFile(gitIgnoreFx, '.nadi', (err) => {
                        if (err) {
                            console.error(err);
                        }
                        else {
                            console.log('.nadi added to .gitignore');
                        }
                    });
                }
            });
        }
    }
}
exports.propertyChek = propertyChek;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
const integrator_factory_1 = __webpack_require__(1);
function activate(context) {
    const integratorFactory = new integrator_factory_1.default(context).create();
    integratorFactory.integrate(context);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map