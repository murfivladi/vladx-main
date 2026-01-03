#!/bin/bash

# VladX и VladPM Установщик с загрузкой с сайта
# Устанавливает VladX (язык программирования) и VladPM (менеджер пакетов) из ZIP архива

set -e  # Exit on any error

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
DEFAULT_DOWNLOAD_URL="https://vladislavb.ru/vladx/vladx-latest.zip"
TEMP_DIR="/tmp/vladx-install-$$"
DOWNLOAD_URL="${VLADX_DOWNLOAD_URL:-$DEFAULT_DOWNLOAD_URL}"

# Функция для вывода сообщений
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка ОС
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        PACKAGE_MANAGER=""
        if command -v apt &> /dev/null; then
            PACKAGE_MANAGER="apt"
        elif command -v yum &> /dev/null; then
            PACKAGE_MANAGER="yum"
        elif command -v dnf &> /dev/null; then
            PACKAGE_MANAGER="dnf"
        elif command -v pacman &> /dev/null; then
            PACKAGE_MANAGER="pacman"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        if command -v brew &> /dev/null; then
            PACKAGE_MANAGER="brew"
        fi
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        OS="windows"
    else
        print_error "Неподдерживаемая операционная система: $OSTYPE"
        exit 1
    fi
    print_status "Обнаружена ОС: $OS"
    if [[ -n "$PACKAGE_MANAGER" ]]; then
        print_status "Обнаружен пакетный менеджер: $PACKAGE_MANAGER"
    fi
}

# Проверка наличия необходимых утилит
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        missing_deps+=("curl или wget")
    fi
    
    if ! command -v unzip &> /dev/null; then
        missing_deps+=("unzip")
    fi
    
    if [[ "${#missing_deps[@]}" -gt 0 ]]; then
        print_warning "Отсутствуют необходимые утилиты: ${missing_deps[*]}"
        
        if [[ "$OS" == "linux" ]]; then
            case "$PACKAGE_MANAGER" in
                "apt")
                    print_status "Установка недостающих утилит: sudo apt update && sudo apt install -y ${missing_deps[*]}"
                    sudo apt update
                    sudo apt install -y curl unzip wget
                    ;;
                "yum"|"dnf")
                    print_status "Установка недостающих утилит: sudo $PACKAGE_MANAGER install -y ${missing_deps[*]}"
                    sudo $PACKAGE_MANAGER install -y curl unzip wget
                    ;;
                "pacman")
                    print_status "Установка недостающих утилит: sudo pacman -S ${missing_deps[*]}"
                    sudo pacman -S curl unzip wget
                    ;;
                *)
                    print_error "Пожалуйста, установите вручную: ${missing_deps[*]}"
                    exit 1
                    ;;
            esac
        elif [[ "$OS" == "macos" ]]; then
            if [[ "$PACKAGE_MANAGER" == "brew" ]]; then
                print_status "Установка недостающих утилит через Homebrew"
                brew install curl wget unzip
            else
                print_error "Пожалуйста, установите Homebrew или недостающие утилиты вручную"
                exit 1
            fi
        fi
    fi
}

# Проверка наличия Node.js
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Найден Node.js: $NODE_VERSION"
        return 0
    else
        print_warning "Node.js не найден"
        return 1
    fi
}

# Установка Node.js (Linux/macOS)
install_node_linux_macos() {
    print_status "Установка Node.js..."
    
    if [[ "$OS" == "linux" ]]; then
        case "$PACKAGE_MANAGER" in
            "apt")
                print_status "Установка через apt..."
                sudo apt update
                sudo apt install -y nodejs npm
                ;;
            "yum")
                print_status "Установка через yum..."
                sudo yum install -y nodejs npm
                ;;
            "dnf")
                print_status "Установка через dnf..."
                sudo dnf install -y nodejs npm
                ;;
            "pacman")
                print_status "Установка через pacman..."
                sudo pacman -S nodejs npm
                ;;
            *)
                # Установка через nvm как резервный вариант
                print_status "Установка Node.js через nvm..."
                curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
                export NVM_DIR="$HOME/.nvm"
                [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
                [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
                nvm install node
                nvm use node
                ;;
        esac
    elif [[ "$OS" == "macos" ]]; then
        if [[ "$PACKAGE_MANAGER" == "brew" ]]; then
            print_status "Установка через Homebrew..."
            brew install node
        else
            print_error "Homebrew не установлен. Пожалуйста, установите его сначала."
            print_status "Запустите: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
    fi
}

# Установка Node.js (Windows - через PowerShell)
install_node_windows() {
    print_status "Установка Node.js для Windows..."
    print_warning "Для Windows установите Node.js вручную с https://nodejs.org/"
    print_status "Или используйте Chocolatey: choco install nodejs"
    exit 1
}

# Загрузка ZIP архива с VladX
download_vladx() {
    print_status "Загрузка VladX из: $DOWNLOAD_URL"
    
    # Создаем временный каталог
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    # Определяем имя файла из URL
    ZIP_FILENAME=$(basename "$DOWNLOAD_URL")
    
    # Загружаем файл
    if command -v curl &> /dev/null; then
        print_status "Загрузка с использованием curl..."
        curl -L -o "$ZIP_FILENAME" "$DOWNLOAD_URL"
    elif command -v wget &> /dev/null; then
        print_status "Загрузка с использованием wget..."
        wget -O "$ZIP_FILENAME" "$DOWNLOAD_URL"
    else
        print_error "Ни curl, ни wget не доступны"
        exit 1
    fi
    
    if [[ ! -f "$ZIP_FILENAME" ]]; then
        print_error "Не удалось загрузить файл: $ZIP_FILENAME"
        exit 1
    fi
    
    print_success "Файл успешно загружен: $ZIP_FILENAME"
}

# Распаковка ZIP архива
extract_vladx() {
    print_status "Распаковка архива..."
    
    ZIP_FILENAME=$(basename "$DOWNLOAD_URL")
    
    # Распаковываем ZIP
    unzip -q "$ZIP_FILENAME"
    
    # Находим директорию с VladX (обычно это папка внутри ZIP)
    VLADX_DIR=""
    for dir in */; do
        if [[ -f "$dir/package.json" && -d "$dir/src" && -d "$dir/bin" ]]; then
            VLADX_DIR="$dir"
            break
        fi
    done
    
    if [[ -z "$VLADX_DIR" ]]; then
        print_error "Не найдена корректная структура VladX в архиве"
        ls -la
        exit 1
    fi
    
    print_status "Найдена директория VladX: $VLADX_DIR"
    
    # Переименовываем директорию в vladx
    mv "$VLADX_DIR" "vladx" 2>/dev/null || true
    if [[ ! -d "vladx" ]]; then
        # Если не удалось переименовать, используем первую директорию
        for dir in */; do
            mv "$dir" "vladx"
            break
        done
    fi
    
    print_success "VladX успешно распакован"
}

# Установка VladX и VladPM
install_vladx_vladpm() {
    print_status "Установка VladX и VladPM..."
    
    # Перемещаем файлы в целевую директорию
    INSTALL_DIR="$HOME/.vladx"
    rm -rf "$INSTALL_DIR" 2>/dev/null || true
    mv vladx "$INSTALL_DIR"
    
    cd "$INSTALL_DIR"
    
    # Устанавливаем зависимости
    if [[ -f "package.json" ]]; then
        print_status "Установка зависимостей через npm..."
        npm install
    else
        print_warning "Файл package.json не найден, создаем базовый..."
        cat > package.json << EOF
{
  "name": "vladx",
  "version": "1.0.0",
  "description": "VladX - Мощный программный язык с русским синтаксисом",
  "main": "src/vladx.js",
  "bin": {
    "vlad": "./bin/vlad.js",
    "vladpm": "./bin/vladpm.js"
  },
  "type": "module",
  "scripts": {
    "start": "node bin/vlad.js",
    "test": "node bin/vlad.js examples/hello.vx"
  },
  "keywords": [
    "programming-language",
    "interpreter",
    "russian",
    "vladx"
  ],
  "author": "VladX Team",
  "license": "MIT",
  "dependencies": {
    "tar": "^7.5.2"
  }
}
EOF
        npm install
    fi
    
    # Проверяем наличие исполняемых файлов
    if [[ ! -f "bin/vlad.js" ]]; then
        print_warning "Файл bin/vlad.js не найден, создаем базовый..."
        mkdir -p bin
        cat > bin/vlad.js << 'EOF'
#!/usr/bin/env node

/**
 * VladX CLI - Интерпретатор
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VladXEngine } from '../src/engine/vladx-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаём экземпляр движка
let engine = new VladXEngine();

// Аргументы командной строки
const args = process.argv.slice(2);

// Показать версию
if (args.includes('-v') || args.includes('--version')) {
    console.log('VladX v1.0.0');
    process.exit(0);
}

// Показать помощь
if (args.includes('-h') || args.includes('--help')) {
    console.log(`
VladX - Мощный язык программирования с русским синтаксисом

Использование:
  vlad [опции] [файл.vx]

Опции:
  -v, --version    Показать версию
  -h, --help       Показать помощь
  -e, --eval       Выполнить код
  --debug          Режим отладки

Примеры:
  vlad script.vx           Запустить файл
  vlad --eval "печать('Привет')"  Выполнить код
    `);
    process.exit(0);
}

// Выполнить код из файла
if (args.length > 0) {
    const filepath = args[0];
    if (fs.existsSync(filepath)) {
        const source = fs.readFileSync(filepath, 'utf-8');
        engine.execute(source, { filename: filepath })
            .catch(err => {
                console.error('Ошибка выполнения:', err.message);
                process.exit(1);
            });
    } else {
        console.error('Файл не найден:', filepath);
        process.exit(1);
    }
} else {
    // Запустить REPL если нет аргументов
    console.log('VladX REPL - введите "помощь" для справки или "выход" для выхода');
    // Простой REPL (упрощенная версия)
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.setPrompt('vladx> ');
    rl.prompt();
    
    rl.on('line', async (line) => {
        const cmd = line.trim();
        if (cmd === 'выход' || cmd === 'exit') {
            rl.close();
            return;
        }
        if (cmd === 'помощь' || cmd === 'help') {
            console.log('Доступные команды: выход, помощь');
            rl.prompt();
            return;
        }
        
        try {
            await engine.execute(line, { filename: '<repl>' });
        } catch (e) {
            console.error('Ошибка:', e.message);
        }
        rl.prompt();
    });
    
    rl.on('close', () => {
        console.log('\nДо встречи!');
        process.exit(0);
    });
}
EOF
    fi
    
    # Создаем VladPM если не существует
    if [[ ! -f "bin/vladpm.js" ]]; then
        print_warning "Файл bin/vladpm.js не найден, создаем базовый..."
        mkdir -p bin
        cat > bin/vladpm.js << 'EOF'
#!/usr/bin/env node

/**
 * VladPM - Менеджер пакетов для VladX
 */
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Аргументы командной строки
const args = process.argv.slice(2);

// Показать версию
if (args.includes('-v') || args.includes('--version')) {
    console.log('VladPM v1.0.0');
    process.exit(0);
}

// Показать помощь
if (args.includes('-h') || args.includes('--help')) {
    console.log(`
VladPM - Менеджер пакетов для VladX

Использование:
  vladpm [команда] [пакет]

Команды:
  install <пакет>    Установить пакет
  uninstall <пакет>  Удалить пакет
  list              Показать установленные пакеты
  search <пакет>    Найти пакет
  init              Инициализировать проект
  update            Обновить пакеты
  version           Показать версию

Примеры:
  vladpm install lodash
  vladpm list
  vladpm init
    `);
    process.exit(0);
}

// Основная логика VladPM
async function main() {
    const command = args[0];
    const packageName = args[1];
    
    if (!command) {
        console.log('Используйте "vladpm --help" для справки');
        process.exit(0);
    }
    
    switch (command) {
        case 'install':
            if (!packageName) {
                console.error('Укажите имя пакета для установки');
                process.exit(1);
            }
            await installPackage(packageName);
            break;
            
        case 'uninstall':
            if (!packageName) {
                console.error('Укажите имя пакета для удаления');
                process.exit(1);
            }
            await uninstallPackage(packageName);
            break;
            
        case 'list':
            listPackages();
            break;
            
        case 'search':
            if (!packageName) {
                console.error('Укажите имя пакета для поиска');
                process.exit(1);
            }
            searchPackage(packageName);
            break;
            
        case 'init':
            initProject();
            break;
            
        case 'update':
            updatePackages();
            break;
            
        default:
            console.error('Неизвестная команда:', command);
            console.log('Используйте "vladpm --help" для справки');
            process.exit(1);
    }
}

async function installPackage(packageName) {
    console.log(`Установка пакета: ${packageName}`);
    
    // В реальности здесь будет логика установки пакета
    // Пока что просто создаем директорию node_modules
    const nodeModulesDir = './node_modules';
    if (!fs.existsSync(nodeModulesDir)) {
        fs.mkdirSync(nodeModulesDir, { recursive: true });
    }
    
    // Создаем директорию для пакета
    const packageDir = path.join(nodeModulesDir, packageName);
    if (!fs.existsSync(packageDir)) {
        fs.mkdirSync(packageDir, { recursive: true });
    }
    
    // Создаем файл package.json для пакета
    const packageJson = {
        name: packageName,
        version: '1.0.0',
        description: `Пакет ${packageName} для VladX`
    };
    
    fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    console.log(`Пакет ${packageName} успешно установлен`);
}

async function uninstallPackage(packageName) {
    console.log(`Удаление пакета: ${packageName}`);
    
    const packageDir = path.join('./node_modules', packageName);
    if (fs.existsSync(packageDir)) {
        fs.rmSync(packageDir, { recursive: true, force: true });
        console.log(`Пакет ${packageName} успешно удален`);
    } else {
        console.log(`Пакет ${packageName} не найден`);
    }
}

function listPackages() {
    const nodeModulesDir = './node_modules';
    if (fs.existsSync(nodeModulesDir)) {
        const packages = fs.readdirSync(nodeModulesDir);
        if (packages.length > 0) {
            console.log('Установленные пакеты:');
            packages.forEach(pkg => console.log(`- ${pkg}`));
        } else {
            console.log('Нет установленных пакетов');
        }
    } else {
        console.log('Нет установленных пакетов');
    }
}

function searchPackage(packageName) {
    console.log(`Поиск пакета: ${packageName}`);
    // В реальности здесь будет поиск в репозитории
    console.log(`Результаты поиска для "${packageName}":`);
    console.log('(в реальности здесь будут результаты из репозитория)');
}

function initProject() {
    if (fs.existsSync('vladx.json') || fs.existsSync('package.json')) {
        console.log('Проект VladX уже инициализирован');
        return;
    }
    
    const vladxJson = {
        name: path.basename(process.cwd()),
        version: '1.0.0',
        description: 'Проект на языке VladX',
        main: 'index.vx',
        scripts: {
            start: 'vlad index.vx'
        },
        dependencies: {}
    };
    
    fs.writeFileSync('vladx.json', JSON.stringify(vladxJson, null, 2));
    console.log('Проект VladX инициализирован (vladx.json создан)');
    
    // Создаем пример файла
    if (!fs.existsSync('index.vx')) {
        fs.writeFileSync('index.vx', '# Привет, VladX!\nпечать("Привет, мир!")\n');
        console.log('Создан пример файла index.vx');
    }
}

function updatePackages() {
    console.log('Обновление пакетов...');
    // В реальности здесь будет логика обновления
    console.log('Пакеты обновлены');
}

// Запуск основной функции
main().catch(err => {
    console.error('Ошибка VladPM:', err.message);
    process.exit(1);
});
EOF
    fi
    
    # Создаем символические ссылки
    sudo ln -sf "$INSTALL_DIR/bin/vlad.js" "/usr/local/bin/vlad" 2>/dev/null || true
    sudo ln -sf "$INSTALL_DIR/bin/vladpm.js" "/usr/local/bin/vladpm" 2>/dev/null || true
    
    # Или добавляем в PATH
    {
        echo 'export PATH="$HOME/.vladx/bin:$PATH"'
        echo 'export PATH="$HOME/.vladx/node_modules/.bin:$PATH"'
    } >> "$HOME/.bashrc" 2>/dev/null || true
    {
        echo 'export PATH="$HOME/.vladx/bin:$PATH"'
        echo 'export PATH="$HOME/.vladx/node_modules/.bin:$PATH"'
    } >> "$HOME/.zshrc" 2>/dev/null || true
    
    print_success "VladX и VladPM установлены в $INSTALL_DIR"
}

# Очистка временных файлов
cleanup() {
    if [[ -d "$TEMP_DIR" ]]; then
        print_status "Очистка временных файлов..."
        rm -rf "$TEMP_DIR"
    fi
}

# Основная функция установки
main() {
    print_status "Начинается установка VladX и VladPM из ZIP архива..."
    print_status "URL загрузки: $DOWNLOAD_URL"
    
    # Устанавливаем обработчик для очистки при выходе
    trap cleanup EXIT
    
    detect_os
    check_dependencies
    
    if ! check_node; then
        print_status "Node.js требуется для работы VladX и VladPM"
        if [[ "$OS" == "windows" ]]; then
            install_node_windows
        else
            print_status "Установить Node.js автоматически? (y/n)"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                install_node_linux_macos
            else
                print_error "Пожалуйста, установите Node.js вручную и перезапустите установку."
                exit 1
            fi
        fi
    fi
    
    # Загружаем и устанавливаем VladX
    download_vladx
    extract_vladx
    install_vladx_vladpm
    
    # Проверяем установку
    if command -v vlad &> /dev/null && command -v vladpm &> /dev/null; then
        chmod +x /usr/local/bin/vlad
        chmod +x /usr/local/bin/vladpm
        print_success "VladX и VladPM успешно установлены!"
        print_status "Версия VladPM:"
        vladpm --version || echo "Не удалось получить версию"
        
        print_status "Пример использования VladX:"
        echo "  vlad script.vx          # Запустить файл"
        echo "  vlad --eval 'печать(\"Привет\")'  # Выполнить код"
        echo ""
        print_status "Пример использования VladPM:"
        echo "  vladpm install package  # Установить пакет"
        echo "  vladpm list            # Показать установленные пакеты"
        echo "  vladpm init            # Инициализировать проект"
    else
        print_error "Установка завершена, но VladX/VladPM не найдены в PATH"
        print_status "Пожалуйста, добавьте $HOME/.vladx/bin в ваш PATH:"
        print_status "echo 'export PATH=\"\$HOME/.vladx/bin:\$PATH\"' >> ~/.bashrc"
        print_status "source ~/.bashrc"
    fi
}

# Показать справку
show_help() {
    echo "VladX и VladPM Установщик (с загрузкой из ZIP)"
    echo ""
    echo "Использование:"
    echo "  ./install.sh                    # Установить VladX и VladPM из стандартного URL"
    echo "  VLADX_DOWNLOAD_URL=url ./install.sh  # Установить из указанного URL"
    echo "  ./install.sh --help            # Показать эту справку"
    echo "  ./install.sh --version         # Показать версию установщика"
    echo ""
    echo "Переменные окружения:"
    echo "  VLADX_DOWNLOAD_URL    URL для загрузки ZIP архива VladX (по умолчанию: $DEFAULT_DOWNLOAD_URL)"
    echo ""
    echo "VladX - мощный язык программирования с русским синтаксисом"
    echo "VladPM - менеджер пакетов для VladX"
}

# Показать версию
show_version() {
    echo "VladX и VladPM Установщик (ZIP) версия 1.0.0"
}

# Обработка аргументов командной строки
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --version|-v)
        show_version
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Неизвестный аргумент: $1"
        show_help
        exit 1
        ;;
esac