import * as fs from 'fs';
import * as path from 'path';
import { config } from "./config";

export function propertyChek() {
    if (config.workingDirectory) {
        const workingDirectory = config.workingDirectory;
        const nadiExtensionDir = path.join(workingDirectory, '/.nadi');
        const gitIgnoreFx = path.join(workingDirectory, '/.gitignore');
        const historyIgnoreFile = path.join(nadiExtensionDir, '/.historyIgnore');
        if (!fs.existsSync(nadiExtensionDir)) {
            fs.mkdirSync(nadiExtensionDir);
        }

        if (!fs.existsSync(historyIgnoreFile)) {
            fs.writeFileSync(historyIgnoreFile,'');
        }

        if (fs.existsSync(gitIgnoreFx)) {
            // add '.nadi' to '.gitignore'
            fs.readFile(gitIgnoreFx, 'utf-8', (err, data) => {
                if(err){
                    console.log(err);
                    return;
                }
                let dataArray = data.split('\n');
                // check '.nadi' if not exist then add
                if (!dataArray.includes('.nadi')) {
                    fs.appendFile(gitIgnoreFx, '.nadi', (err) => {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log('.nadi added to .gitignore');
                        }
                    });
                }
            });
        }
    }
}