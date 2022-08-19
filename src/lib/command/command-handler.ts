import { config } from "../global/config";
import { MakeFile } from "../make-directory-file";
import * as path from 'path';
import * as fs from 'fs';

export default class CommandHandler {
    private _vscode: any;
    constructor(params: any) {
        this._vscode = params.vscode
    }

    execute(name: string, options?: any) {
        const workingFolder = this._vscode.Uri.parse(this._vscode.workspace.workspaceFolders[0].uri.path);
        const makeFile = new MakeFile();
        switch (name) {
            case 'create-folder':
                return makeFile.createFileOrFolder('folder', workingFolder ? makeFile.findDir(workingFolder.fsPath) : '/');
            case 'create-file':
                return makeFile.createFileOrFolder('file', workingFolder ? makeFile.findDir(workingFolder.fsPath) : '/');
            case 'history-ignore-file':
                const path = options.fsPath;
                this._addToHistoryIgnoreList(path)
                return;
            default:
                return;
        }
    }

    _addToHistoryIgnoreList(targetPath: string) {
        const $this = this;
        let historyIgnoreFile = path.join(config.localDirectory,'.historyIgnore');
        let cleanTargetPath = targetPath.replace(config.workingDirectory + '/','');
        if (fs.existsSync(historyIgnoreFile)) {
            fs.readFile(historyIgnoreFile, 'utf-8', (err, data) => {
                if(err){
                    console.log(err);
                    return;
                }
                let dataArray = data.split('\n');
                if (!dataArray.includes(cleanTargetPath)) {
                    fs.appendFile(historyIgnoreFile, (dataArray.length > 0 && dataArray[0].trim() != '' ? '\n' : '') + cleanTargetPath, (err) => {
                        if (err) {
                            console.error(err);
                        } else {
                            $this._vscode.commands.executeCommand("workbench.action.reloadWindow");
                        }
                    });
                }
            });
        }
    }
}