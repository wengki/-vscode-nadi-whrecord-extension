
import { Uri } from 'vscode';
import * as constant from '../lib/const';
const path = require('path');
const querystring = require('querystring');

export class UriService {
    private readonly _Uri: any | { parse: any } | { parse: any };
    private readonly _getCurrentDate: any;

    constructor(params: any) {
        this._Uri = params.Uri;
        this._getCurrentDate = params.getCurrentDateFn;
    }

    convertToAnnotateFileAction(uri: Uri) {
        const queryParams = this._getQueryParams(uri);
        return queryParams ?
            this._Uri.parse(`${constant.EXTENSION_NAME}:annotate-file?${querystring.stringify(queryParams)}`) :
            null;
    }

    _getQueryParams(uri: Uri) {
        if (uri.scheme === 'file') {
            return {
                path: uri.fsPath,
                _ts: this._getCurrentDate()
            };
        }
        if (uri.scheme === constant.EXTENSION_NAME && this.getAction(uri) === 'takediff') {
            const queryObject = querystring.parse(uri.query);
            if (!queryObject.previousCommitHash || !queryObject.previousPath) return null;
            return {
                path: queryObject.previousPath,
                commitHash: queryObject.previousCommitHash,
                repositoryRoot: queryObject.repositoryRoot
            };
        }
        throw new Error('Annotation cannot be given for this editor contents');
    }

    getAction(uri: Uri) {
        return uri.scheme === constant.EXTENSION_NAME ? uri.path.split('/')[0] : null;
    }

    encodeShowFileAction(params: { path: string}) {
        const encodedParams = querystring.stringify(params);

        // Need filename in the path so that editor can understand filetype
        // console.log(params.path);
        const uriPath = 'takediff' + (params.path ? `/${path.basename(params.path)}` : '');
        // const uriPath = 'takediff';
        return this._Uri.parse(`${constant.EXTENSION_NAME}:${uriPath}?${encodedParams}`);
    }

}
