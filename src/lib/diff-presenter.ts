import * as vscode from 'vscode';
import { UriService } from '../service/uri-service';
import * as path from 'path';

export default class DiffPresenter {
    private readonly _uriService: UriService;
    extensionScheme = 'partialdiff';
    diffModeSymbols: any = {
        normalised: '\u007e',
        asIs: '\u2194'
    };
    private readonly commands = vscode.commands;

    constructor(
    ) {
        this._uriService = new UriService({
            Uri: vscode.Uri,
            getCurrentDateFn: Date
        });
    }

    buildTitle(date, exactPath) {
        // return `${exactPath} ${this.diffModeSymbols.normalised} ${date}`;
        return `[${date}]: ${exactPath}`;
    }

    async takeDiff(uri1: string, uri2: string, date: string, exactPath: string): Promise<{} | undefined> {

        const title = this.buildTitle(date, exactPath);
        const ext = path.extname(exactPath);
        const uriBefore = this._uriService.encodeShowFileAction({ path: uri1 + ext });
        const uriAfter = this._uriService.encodeShowFileAction({ path: uri2 + ext });

        return this.commands.executeCommand('vscode.diff', uriBefore, uriAfter, title, {
            column: vscode.ViewColumn.Active
        });
    }
}