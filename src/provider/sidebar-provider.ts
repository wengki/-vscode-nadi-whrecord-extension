import { rejects } from "assert";
import * as vscode from "vscode";
import { getNonce } from "../getNonce";
import { WorkingFilesHistoryTab } from './working-files-history-provider';
import { WorkingHistoryFiles } from "../service/working-history-files";
import { Settings } from "../lib/settings";

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;

  constructor(private readonly _extensionUri: vscode.Uri,
    private context: vscode.ExtensionContext,
    private settings: Settings
  ) {

  }

  _historyWorkData() {
    return new WorkingHistoryFiles();
  }

  public async eventDataChange() {
    const monthList = await this._historyWorkData().getHistoryByMonth();
    if (this._view) {
      this._view.webview.postMessage({
        type: 'onHistoryChange',
        value: monthList
      })
    }
  }

  public async resolveWebviewView(webviewView: vscode.WebviewView) {
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
        case "onReloadWindow": {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
          break;
        }
        case "onRunDeveloperTool": {
          vscode.commands.executeCommand("workbench.action.webview.openDeveloperTools");
          break;
        }
        case "onOpenWorkingFilesHistory": {
          WorkingFilesHistoryTab.kill();
          WorkingFilesHistoryTab.createOrShow(this._extensionUri, data.value);
          break;
        }
        case "getHistoryOfMonth": {
          const list = await this._historyWorkData().getHistoryDatesByMonth(data.value)
          // console.log(list);
          webviewView.webview.postMessage({
            type: 'getHistoryOfMonth',
            value: {
              key: data.value,
              list: list
            }
          })
          break;
        }
        case "settingHistoryIgnoreRemoveItem": {
          const doRemoveHistItem = await this.settings.removeHistoryIgnoreItem(data.value);
          if(doRemoveHistItem === false){
            webviewView.webview.postMessage({
              type: 'settingHistoryIgnoreCANCELRemoveItem',
              value: 'cancel'
            })
          }
          break;
        }
      }
    });
  }

  public revive(panel: vscode.WebviewView) {
    this._view = panel;
  }

  private async _getHtmlForWebview(webview: vscode.Webview) {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "compiled/Sidebar.js")
    );
    const stylesPathNadiCss = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "nadi-extension.css")
    );

    const nonce = getNonce();
    const initHistoryList = await this._historyWorkData().getHistoryByMonth();
    const settings = {
      historyIgnore: this.settings.getHistoryIgnoreList(true)
    };

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${webview.cspSource
      }; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <link href="${stylesPathNadiCss}" rel="stylesheet">
                <script nonce="${nonce}">
                    const nadivscode = acquireVsCodeApi();
                    const initHistoryList = ${JSON.stringify(initHistoryList)}
                    const settings = ${JSON.stringify(settings)}
                </script>
            </head>
            <body>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
} 