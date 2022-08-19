import * as fs from 'fs';
import { TextDocumentContentProvider } from 'vscode';
import { UriService } from '../service/uri-service';
import * as path from 'path';

const querystring = require('querystring');

export default class ContentProvider implements TextDocumentContentProvider {
    private readonly _uriService: UriService;

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
        return fs.readFileSync(fPath, {
            encoding: 'utf-8',
        });
    }
}
