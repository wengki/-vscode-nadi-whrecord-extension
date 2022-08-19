import * as fs from 'fs';
import * as path from 'path';
import { config } from './global/config';
import * as _ from "lodash";

export class Settings {
    private _vscode: any;
    private _context: any;
    public historyIgnoreFile: string;
    constructor(params: { vscode: any, context: any }) {
        this._vscode = params.vscode;
        this._context = params.context;
        this.historyIgnoreFile = path.join(config.localDirectory, '.historyIgnore');
    }

    getHistoryIgnoreList(withoutDefault?: boolean) {
        let ingoreList: Array<string> = [];
        if (fs.existsSync(this.historyIgnoreFile)) {
            const ignoreFromFile = fs.readFileSync(this.historyIgnoreFile, { encoding: 'utf-8' });
            ingoreList = ignoreFromFile.split('\n');
        }
        if (!withoutDefault) {
            ingoreList.push('.nadi');
        }
        return ingoreList;
    }

    async removeHistoryIgnoreItem(value: string) {
        const ask = await this._vscode.window.showInformationMessage(`Delete "${value}" from History Ignore?`, "Yes", "No");
        if (ask === "Yes") {
            let list = this.getHistoryIgnoreList(true);
            fs.writeFileSync(this.historyIgnoreFile, _.filter(list, (item) => { return item != value;}).join('\n'));
            this._vscode.commands.executeCommand("workbench.action.reloadWindow");
        } else {
            return false;
        }
    }
}