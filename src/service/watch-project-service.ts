;import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../lib/global/config';
import { md5 } from '../lib/utility/md5';
import { MakeFile } from "../lib/make-directory-file";

interface ChangeFileDBToSave {
    md5FileName: string,
    event: string,
    path: string,
    content: string
}

export class WatchWorkingDirectory {
    workingFiles: object = {};
    encryption;
    historyDirectory;
    makeFile;
    context: vscode.ExtensionContext;
    sidebar: any;
    settings: any;
    constructor(params: {
        context: any,
        sidebar: any,
        settings: any
    }) { 
        this.historyDirectory = path.join(config.localDirectory,'/history');
        this.makeFile = new MakeFile();
        this.context = params.context;
        this.sidebar = params.sidebar;
        this.settings = params.settings;
    }

    getFilesOnTabs() {
        for (let tabGroup of vscode.window.tabGroups.all) {
            const activeTab: any = tabGroup.activeTab?.input;
            if (activeTab && activeTab.hasOwnProperty('uri')) {
                this.readFileChange(activeTab.uri.fsPath, 'open');
            }

            const inactiveOpenedTab: any = tabGroup.tabs;
            inactiveOpenedTab.forEach((tab: any) => {
                const tbInput: any = tab.input;
                if (tbInput && tbInput.hasOwnProperty('uri')) {
                    this.readFileChange(tbInput.uri.fsPath, 'open');
                }
            });
        }
    }

    checkIfContentChanges(md5FileName: string, md5Content: string, fullPath: string,  content: string): boolean {
        if (this.workingFiles && !this.workingFiles.hasOwnProperty(md5FileName)) {
            Object.assign(this.workingFiles, {
                [md5FileName]: md5Content
            });

            this.storeDBOriginalFile(md5FileName, content);
            
            return false;
        } else {
            const tmpDataFile = this.workingFiles[md5FileName as keyof typeof this.workingFiles];
            if (tmpDataFile === md5Content) {
                return false;
            } else {
                return true;
            }
        }
    }

    readFileChange(fullPath: string, event: string) {
        const md5FileName: string = md5(fullPath);
        fs.readFile(fullPath, { encoding: 'utf8', flag: 'r' }, (err, content) => {
            if (err) {
                return;
            }
            const md5Content = md5(content);
            const isSaveFileData = this.checkIfContentChanges(md5FileName, md5Content, fullPath, content);
            if(isSaveFileData || event === 'rename'){
                this.storeDBFile({
                    md5FileName: md5FileName,
                    event: event,
                    path: fullPath,
                    content: content
                });
                this.fireEventDataChange();
            } 
        });
    }

    getTodayHistoryFolderName(): string {
        const dt = new Date();
        const timeFolder = dt.setHours(0o0,0o0,0o0,0o00);
        return path.join(this.historyDirectory, `/${timeFolder.toString()}`);
    }

    storeDBOriginalFile(md5FileName: string, content: string) {
        const todayHistoryStorage = this.getTodayHistoryFolderName();
        const historyFileName = path.join(todayHistoryStorage, `/origin/${md5FileName}`);

        if(!fs.existsSync(path.dirname(historyFileName))){
            this.makeFile.makeDirSync(path.dirname(historyFileName));
        }

        if(!fs.existsSync(historyFileName)){
            fs.writeFileSync(historyFileName, content);
        }
    }

    storeDBFile(fileData: ChangeFileDBToSave) {
        const todayHistoryStorage = this.getTodayHistoryFolderName();
        const historyFileName = path.join(todayHistoryStorage, `/${fileData.md5FileName}.json`);
        const cuurenContentFileName = path.join(todayHistoryStorage, `/last/${fileData.md5FileName}`);

        if(!fs.existsSync(path.dirname(historyFileName))){
            this.makeFile.makeDirSync(path.dirname(historyFileName));
        }

        if(!fs.existsSync(path.dirname(cuurenContentFileName))){
            this.makeFile.makeDirSync(path.dirname(cuurenContentFileName));
        }

        let histData: any = {};

        if(fs.existsSync(historyFileName)){
            const existData = fs.readFileSync(historyFileName, { encoding: 'utf-8' });
            histData = JSON.parse(existData);
        }
        histData = Object.assign(histData, {
            [fileData.event]: new Date().getTime(),
            'rpath': fileData.path.replace(config.workingDirectory ? config.workingDirectory + '/' : '', ''),
        });

        fs.writeFileSync(historyFileName, JSON.stringify(histData));
        fs.writeFileSync(cuurenContentFileName, fileData.content);
    }

    fireEventDataChange(){
        if(this.sidebar.eventDataChange !== undefined){
            this.sidebar.eventDataChange();
        }
    }

    async run() {
        try {
            if (config.workingDirectory) {
                const workingDir = config.workingDirectory;
                const $this = this;

                let ingoreList: Array<string> = this.settings.getHistoryIgnoreList();
                fs.watch(workingDir, { persistent: true, recursive: true }, function (event, fileName) {
                    let fullPath = path.join(workingDir, fileName);
                    let processHistory = true;
                    ingoreList.forEach((prefix) => {
                        if(fileName.startsWith(prefix.trim())){
                            processHistory = false;
                        }
                    })
                    if(processHistory){
                        $this.readFileChange(fullPath, event);
                    }
                });
            }

        } catch (error) {
            console.log('ERROR: ', error);
        }
    }
}