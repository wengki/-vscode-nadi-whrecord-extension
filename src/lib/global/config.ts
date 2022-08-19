import * as vscode from 'vscode';
import * as path from "path";

interface NadiExtensionConfig {
    workingDirectory: string | null,
    localDirectory: string,
    gitIgnore: string,
}
var configData: NadiExtensionConfig = {
    workingDirectory: null,
    localDirectory: '/.nadi',
    gitIgnore: '/.gitignore',
};

if (vscode.workspace.workspaceFolders !== undefined) {
    configData.workingDirectory = vscode.workspace.workspaceFolders[0].uri.path;
    configData.localDirectory = path.join(configData.workingDirectory, configData.localDirectory);
    configData.gitIgnore = path.join(configData.workingDirectory, configData.gitIgnore);
} else {
    configData.workingDirectory = '';
    configData.localDirectory = '';
    configData.gitIgnore = '';
}

export const config = configData;