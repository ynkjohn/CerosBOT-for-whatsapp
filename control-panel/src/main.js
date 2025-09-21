const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');

// Suprimir TODAS as mensagens de erro e warnings
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.ELECTRON_NO_ATTACH_CONSOLE = 'true';

// Configurações para resolver erros de GPU e suprimir logs
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('--no-sandbox');
app.commandLine.appendSwitch('--disable-gpu');
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');
app.commandLine.appendSwitch('--disable-features=TranslateUI');
app.commandLine.appendSwitch('--disable-ipc-flooding-protection');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
app.commandLine.appendSwitch('--log-level=3');
app.commandLine.appendSwitch('--silent');

// Suprimir erros no console
const originalConsoleError = console.error;
console.error = function(...args) {
  const message = args.join(' ');
  // Suprimir erros específicos do GPU e cache
  if (message.includes('GPU') || 
      message.includes('cache') || 
      message.includes('GLES') || 
      message.includes('ContextResult') ||
      message.includes('exited unexpectedly')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Mantém referência global da janela
let mainWindow;
let isDev = process.argv.includes('--dev');

function createWindow() {
  // Cria a janela do navegador
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      backgroundThrottling: false,
      offscreen: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
    titleBarStyle: 'default',
    backgroundColor: '#1a1a1a',
    autoHideMenuBar: false,
    useContentSize: true
  });

  // Carrega o arquivo HTML da aplicação
  mainWindow.loadFile(path.join(__dirname, 'index.html')).catch(error => {
    console.error('Erro ao carregar arquivo HTML:', error);
    dialog.showErrorBox('Erro de Inicialização', 'Não foi possível carregar a interface do aplicativo.');
  });

  // Mostra a janela quando estiver pronta
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Tratamento de erro de carregamento
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Falha ao carregar: ${errorCode} - ${errorDescription} - ${validatedURL}`);
    dialog.showErrorBox('Erro de Carregamento', `Não foi possível carregar: ${validatedURL}`);
  });

  // Emitido quando a janela for fechada
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Intercepta links externos
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Menu da aplicação
  const menuTemplate = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Recarregar',
          accelerator: 'F5',
          click: () => {
            mainWindow.reload();
          }
        },
        {
          label: 'DevTools',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        {
          label: 'Sair',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Bot',
      submenu: [
        {
          label: 'Status do Bot',
          click: () => {
            // Enviar evento para a página
            mainWindow.webContents.send('menu-action', 'show-status');
          }
        },
        {
          label: 'Configurações',
          click: () => {
            mainWindow.webContents.send('menu-action', 'show-config');
          }
        },
        {
          label: 'Logs',
          click: () => {
            mainWindow.webContents.send('menu-action', 'show-logs');
          }
        }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre',
              message: 'Ceros AI Control Panel',
              detail: 'Versão 1.0.0\\n\\nPainel de controle para gerenciar o bot Ceros AI.\\n\\n© 2025 Ceros AI Team'
            });
          }
        },
        {
          label: 'GitHub',
          click: () => {
            shell.openExternal('https://github.com');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

// Este método será chamado quando o Electron terminar
// a inicialização e estiver pronto para criar janelas do navegador.
app.whenReady().then(createWindow);

// Sai quando todas as janelas forem fechadas, exceto no macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // No macOS, é comum recriar uma janela no app quando o
  // ícone do dock é clicado e não há outras janelas abertas.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Impede navegação para URLs externas
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      
      // Permite apenas localhost e file://
      if (parsedUrl.origin !== 'http://localhost:3001' && !navigationUrl.startsWith('file://')) {
        console.warn('Bloqueada navegação para:', navigationUrl);
        event.preventDefault();
      }
    } catch (error) {
      console.error('Erro ao validar URL de navegação:', error);
      event.preventDefault();
    }
  });

  // Previne abertura de novas janelas não autorizadas
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
        return { action: 'allow' };
      }
    } catch (error) {
      console.error('Erro ao validar URL de nova janela:', error);
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
});
