import *  as _vscode from "vscode";

declare global {
    const nadivscode: {
        postMessage: ({ type: string, value: any}) => void;
    };
    const workFilesHistory: Array<any>;
    const initHistoryList: any;
    const targetFolderData: any;
    const settings: any;
}