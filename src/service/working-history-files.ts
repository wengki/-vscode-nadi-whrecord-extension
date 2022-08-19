import * as fs from 'fs';
import * as path from 'path';
import { config } from '../lib/global/config';
import DiffPresenter from '../lib/diff-presenter';

export class WorkingHistoryFiles {
    private diffPresenter = new DiffPresenter();
    private historyDirectoryFullpath: string;
    constructor() {
        this.historyDirectoryFullpath = path.join(config.localDirectory, '/history');
    }

    convertTimeToDate(timestamp: string, type?: string) {
        var month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        var monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dirnameToDate = new Date(parseInt(timestamp));
        var dd = String(dirnameToDate.getDate()).padStart(2, '0');
        var m = String(dirnameToDate.getMonth() + 1).padStart(2, '0');
        var mm = monthShort[dirnameToDate.getMonth()];
        var mmm = month[dirnameToDate.getMonth()];
        var yyyy = dirnameToDate.getFullYear();

        // return`${yyyy}-${mm}-${dd}`;
        switch (type) {
            case 'short':
                return `${mm} ${dd}, ${yyyy}`;
            case 'monthYear':
                return `${mmm} ${yyyy}`
            case 'monthYearNumber':
                return `${yyyy}${m}`
            default:
                return `${mmm} ${dd}, ${yyyy}`;
        }
    }

    readHistoryFolder() {
        let histDBList: any[] = [];
        const historyDirectory = fs.readdirSync(this.historyDirectoryFullpath, { withFileTypes: true });
        historyDirectory.forEach((dir) => {
            const historyMemberFullpath = path.join(this.historyDirectoryFullpath, dir.name);
            if (fs.statSync(historyMemberFullpath).isDirectory()) {
                const historyCollection = fs.readdirSync(historyMemberFullpath, { withFileTypes: true });
                const convertNameDt = this.convertTimeToDate(dir.name);
                histDBList.push({
                    dirname: dir.name,
                    text: convertNameDt,
                    path: historyMemberFullpath,
                    collections: historyCollection
                });
            }
        });

        return histDBList;
    }

    readHistoryCollections(fullPath: string) {
        let list: Array<any> = [];
        if (fs.statSync(fullPath).isDirectory()) {
            const collections = fs.readdirSync(fullPath, { withFileTypes: true });
            collections.forEach((file) => {
                let collectionFileFullPath = path.join(fullPath, file.name);
                if (fs.statSync(collectionFileFullPath).isFile()) {
                    let dataContent = fs.readFileSync(collectionFileFullPath, { encoding: 'utf-8' });
                    dataContent = JSON.parse(dataContent);
                    list.push(Object.assign(dataContent, { index: path.basename(collectionFileFullPath, '.json') }));
                }
            });
            // console.log(list);
        }
        return { [path.basename(fullPath)]: list };
    }

    async getHistoryByMonth() {
        let list: any = {};
        if (fs.statSync(this.historyDirectoryFullpath).isDirectory()) {
            const allList = await fs.readdirSync(this.historyDirectoryFullpath, { withFileTypes: true });
            allList.forEach((dir) => {
                const yrMonth = this.convertTimeToDate(dir.name, 'monthYear');
                const yrMonthNum = this.convertTimeToDate(dir.name, 'monthYearNumber');

                if (!list.hasOwnProperty(yrMonthNum)) {
                    Object.assign(list, {
                        [yrMonthNum]: {
                            text: yrMonth,
                            count: 1
                        }
                    })
                } else {
                    const item = list[yrMonthNum as keyof typeof list];
                    Object.assign(list, {
                        [yrMonthNum]: {
                            text: yrMonth,
                            count: item.count + 1
                        }
                    })
                }
            })
        }
        return list;
    }

    async getHistoryDatesByMonth(yearMonthNumber: any) {
        let list: Array<any> = [];
        if (fs.statSync(this.historyDirectoryFullpath).isDirectory()) {
            const allList = await fs.readdirSync(this.historyDirectoryFullpath, { withFileTypes: true });
            allList.forEach((dir) => {
                const date = this.convertTimeToDate(dir.name);
                const yrMonthNum = this.convertTimeToDate(dir.name, 'monthYearNumber');
                const lastChangeHistDir = path.join(this.historyDirectoryFullpath,dir.name, 'last');
                let count = 0;
                if(fs.existsSync(lastChangeHistDir)){
                    const dirMember = fs.readdirSync(lastChangeHistDir);
                    count = dirMember.length;
                }
                if(yearMonthNumber === yrMonthNum){
                    list.push({
                        text: date,
                        dirname: dir.name,
                        count: count
                    })
                }
            })
        }
        return list;
    }

    async takeHistoryDiff(historyItem: any) {
        // console.log(historyItem);
        const historyDir = path.join(config.localDirectory, '/history');
        const dataParentDir = path.join(historyDir, historyItem.dirname);

        const originFx = path.join(dataParentDir, '/origin', historyItem.index);
        const lastFx = path.join(dataParentDir, '/last', historyItem.index);
        // console.log('originFx, lastFx', originFx, lastFx);

        // if(!fs.existsSync(originFx)){
        //     vscode.window.showErrorMessage(`The origin file of ${historyItem.rpath} of ${this.convertTimeToDate(historyItem.dirname)},  is unvailable!`);
        //     return;
        // }

        // if(!fs.existsSync(lastFx)){
        //     vscode.window.showErrorMessage(`The last changed file  file of ${historyItem.rpath} of ${this.convertTimeToDate(historyItem.dirname)} is unvailable!`);
        //     return;
        // }

        let date = this.convertTimeToDate(historyItem.dirname, 'short');

        await this.diffPresenter.takeDiff(originFx, lastFx, date, historyItem.rpath);
    }

}