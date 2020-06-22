import { LOCAL_SERVER_PORT, electronStore, BLOCKCHAIN_STORE_PATH, MAC_GAME_PATH, WIN_GAME_PATH } from './config';
import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { download, Options as ElectronDLOptions } from 'electron-dl';
import trayImage from './resources/Cat.png'
import "@babel/polyfill"
import * as constant from './constant';
import log from 'electron-log';

declare const ENVIRONMENT: String;

const IS_DEV = ENVIRONMENT == "development";

Object.assign(console, log.functions);

let win: BrowserWindow | null = null;
let tray: Tray;
let node: ChildProcess
let isQuiting: boolean = false;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
        },
        frame: true,
        resizable: false,
        autoHideMenuBar: true,
    });

    console.log(app.getAppPath());

    if (IS_DEV) {
        win.loadURL('http://localhost:9000');
        win.webContents.openDevTools();
    }
    else {
        win.loadFile('index.html');
    }

    win.on('minimize', function (event: any) {
        event.preventDefault();
        win?.hide();
    });

    win.on('close', function (event: any) {
        if (!isQuiting) {
            event.preventDefault();
            win?.hide();
        }
    });
}

app.on("ready", () => {
    execute(path.join(app.getAppPath(), 'publish', 'NineChronicles.Standalone.Executable'), [
        '--graphql-server=true',
        `--graphql-port=${LOCAL_SERVER_PORT}`
    ])
    //asp net 서버가 구동되기까지의 시간이 필요합니다.
    createWindow();
    createTray(path.join(app.getAppPath(), trayImage));
});

app.on('before-quit', (event) => {
    if (node != null) {
        if (process.platform == 'darwin') node.kill('SIGTERM');
        if (process.platform == 'win32') execute('taskkill', ['/pid', node.pid.toString(), '/f', '/t'])
    }
});

app.on('activate', (event) => {
    event.preventDefault();
    win?.show();
})

ipcMain.on("download snapshot", (event, options: IDownloadOptions) => {
    options.properties.onProgress = (status: IDownloadProgress) => win?.webContents.send("download progress", status);
    options.properties.directory = app.getPath('userData');
    console.log(win);
    if (win != null) {
        download(win, electronStore.get('SNAPSHOT_DOWNLOAD_PATH') as string, options.properties)
            .then(dl => { win?.webContents.send("download complete", dl.getSavePath()); console.log(dl) });
    }
});

ipcMain.on("launch game", (event, info) => {
    execute(path.join(
        app.getAppPath(),
        process.platform === 'darwin'
            ? MAC_GAME_PATH
            : WIN_GAME_PATH
    ), info.args)
})

function execute(binaryPath: string, args: string[]) {
    console.log(`Execute subprocess: ${binaryPath} ${args.join(' ')}`)
    node = spawn(binaryPath, args)

    node.stdout?.on('data', data => {
        console.log(`child process stdout from [ ${binaryPath} ]\n${data}`);
    });

    node.stderr?.on('data', data => {
        console.log(`child process stderr from [ ${binaryPath} ]\n${data}`);
    });
}

function createTray(iconPath: string) {
    let trayIcon = nativeImage.createFromPath(iconPath);
    trayIcon = trayIcon.resize({
        width: 16,
        height: 16
    });
    tray = new Tray(trayIcon);
    tray.setContextMenu(Menu.buildFromTemplate([
        {
            label: 'Open Window', click: function () {
                win?.show()
            }
        },
        {
            label: 'Quit Launcher', click: function () {
                isQuiting = true;
                app.quit();
            }
        },
    ]));
    return tray;
}
