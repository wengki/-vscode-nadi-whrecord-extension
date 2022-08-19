
import { MakeFile } from "../make-directory-file";

export default class CommandHandler {
    private _vscode: any;
    constructor(params: any) {
        this._vscode = params.vscode
    }

    execute(name: string) {
        const workingFolder = this._vscode.Uri.parse(this._vscode.workspace.workspaceFolders[0].uri.path);
        const makeFile = new MakeFile();
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