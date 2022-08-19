import * as vscode from 'vscode';
import Integrator from "./integrator";
import { NExecutionContext } from './types/vscode';
import CommandHandler from './command/command-handler';
import { SidebarProvider } from '../provider/sidebar-provider';
import ContentProvider from '../provider/content-provider';
import { UriService } from '../service/uri-service';
import { Settings } from './settings';

export default class IntegratorFactory {
    private readonly _extensionContext: any;
    private _command: CommandHandler;
    private _sidebar: SidebarProvider;
    private _uriService: UriService;
    private _contentProvider: ContentProvider;

    constructor(extensionContext: NExecutionContext){
        this._extensionContext = extensionContext;
    }

    create(){
        return new Integrator({
            vscode,
            command: this._getCommand(),
            sidebar: this._getSidebar(),
            contentProvider: this._getContentProvider(),
            context: this._extensionContext,
            settings: this._getSettings(),
        })
    }

    _getCommand() {
        this._command = this._command || this._createCommand();
        return this._command;
    }

    _createCommand() {
        return new CommandHandler({
            vscode,
            extensionContext: this._extensionContext
        });
    }

    _getSidebar() {
        this._sidebar = this._sidebar || this._createSidebar();
        return this._sidebar;
    }

    _createSidebar() {
        return new SidebarProvider(this._extensionContext.extensionUri, this._extensionContext, this._getSettings());
    }

    _getContentProvider() {
        this._contentProvider = this._contentProvider || this._createContentProvider();
        return this._contentProvider;
    }

    _createContentProvider() {
        return new ContentProvider({ uriService: this._getUriService()});
    }

    _getUriService() {
        this._uriService = this._uriService || this._createUriService();
        return this._uriService;
    }

    _createUriService() {
        return new UriService({
            Uri: vscode.Uri,
            getCurrentDateFn: () => Date.now()
        });
    }

    _getSettings() {
        return new Settings({
            vscode,
            context: this._extensionContext
        });
    }
}