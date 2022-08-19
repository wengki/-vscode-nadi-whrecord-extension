import { ExtensionContext } from 'vscode';
import { WatchWorkingDirectory } from '../service/watch-project-service';
import CommandHandler from './command/command-handler';
import * as constant from './const';
import { propertyChek } from "./global/property-check";

export default class Integrator {
    private readonly _vscode: any;
    private _commandHandler: CommandHandler;
    private _sidebar: any;
    private _contentProvider: any;
    private _extensionContext: ExtensionContext;
    private _settings: any;

    constructor(params: { vscode: any, command: any , sidebar: any, contentProvider: any, context: any, settings: any}) {
        this._vscode = params.vscode;
        this._commandHandler = params.command; 
        this._sidebar = params.sidebar; 
        this._contentProvider = params.contentProvider;
        this._extensionContext = params.context;
        this._settings = params.settings;
    }

    integrate(context:ExtensionContext) {
        this._registerCommands(context);
        this._registerWindowProviders(context);
        this._registerProviders(context);
        this._projectFolderWatch();
    }

    _registerCommands(context: ExtensionContext) {
        this._getCommands().forEach(command => {
            const handler = command.handler;
            const disposable = this._vscode.commands[command.registrar](
                `${constant.EXTENSION_NAME}.${command.name}`,
                handler.execute.bind(handler, command.name)
                // (scm) => {
                //     handler.execute.bind(handler, command.name, scm);
                // }
            );
            context.subscriptions.push(disposable);
        })
    }

    _registerProviders(context) {
        const disposable = this._vscode.workspace.registerTextDocumentContentProvider(
            constant.EXTENSION_NAME, this._contentProvider);
        context.subscriptions.push(disposable);
    }

    _registerWindowProviders(context: ExtensionContext) {
        this._getWindows().forEach(win => {
            const window = this._vscode.window[win.registrar](
                win.name,
                win.handler
            )
            context.subscriptions.push(window);
        })
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
            {
                name: 'history-ignore-file',
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
        propertyChek();
        const projectFolderWatch = new WatchWorkingDirectory({ context: this._extensionContext, sidebar:this._sidebar, settings: this._settings});
        projectFolderWatch.getFilesOnTabs();
        projectFolderWatch.run();
    }
}