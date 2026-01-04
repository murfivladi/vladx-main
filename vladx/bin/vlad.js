#!/usr/bin/env node

/**
 * VladX CLI — Производственная версия, написанная с нуля
 * Максимум функций, максимум стабильности, ноль утечек
 */
// Принудительно включаем цвета в терминале
process.env.FORCE_COLOR = '1';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { VladXEngine } from '../src/engine/vladx-engine.js';

// Создаём экземпляр движка
let engine = new VladXEngine();

// ==================== КОНСТАНТЫ ====================
const VERSION = '1.0.0';
const HISTORY_PATH = path.join(os.homedir(), '.vladx', 'repl-history.txt');
const MAX_HISTORY = 1000;
const MAX_BUFFER_SIZE = 50000; // Ограничение на размер буфера (защита от OOM)
const MAX_EXECUTION_TIME = 30000; // Ограничение времени выполнения

// ==================== УТИЛИТЫ ПАРСИНГА АРГУМЕНТОВ ====================
function parseCommandLine(argv) {
    const args = argv.slice(2);
    const options = {
        mode: 'repl', // 'repl', 'file', 'eval', 'compile'
        file: null,
        evalCode: null,
        outputPath: null,
        debug: false,
        timeout: MAX_EXECUTION_TIME,
        help: false,
        version: false,
        programArgs: []
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '-h' || arg === '--help') {
            options.help = true;
            continue;
        }

        if (arg === '-v' || arg === '--version') {
            options.version = true;
            continue;
        }

        if (arg === '-r' || arg === '--repl') {
            options.mode = 'repl';
            continue;
        }

        if (arg === '-e' || arg === '--eval') {
            options.mode = 'eval';
            options.evalCode = args[++i];
            continue;
        }

        if (arg === '-c' || arg === '--compile') {
            options.mode = 'compile';
            options.file = args[++i];
            continue;
        }

        if (arg === '-o' || arg === '--output') {
            options.outputPath = args[++i];
            continue;
        }

        if (arg === '--debug') {
            options.debug = true;
            continue;
        }

        if (arg === '--no-timeout') {
            options.timeout = 0;
            continue;
        }

        if (arg === '--stack-size') {
            i++; // Пропускаем значение
            continue;
        }

        // Файл для запуска
        if (!options.file && !arg.startsWith('-')) {
            const ext = path.extname(arg);
            if (['.vx', '.vladx'].includes(ext)) {
                options.file = arg;
                if (options.mode === 'repl') options.mode = 'file';
            } else {
                options.programArgs.push(arg);
            }
        } else {
            options.programArgs.push(arg);
        }
    }

    return options;
}

// ==================== УТИЛИТЫ ИСТОРИИ ====================
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_PATH)) {
            return fs.readFileSync(HISTORY_PATH, 'utf-8')
                .split('\n')
                .filter(l => l.trim())
                .slice(-MAX_HISTORY);
        }
    } catch (error) {
        // Игнорируем ошибки загрузки истории
    }
    return [];
}

function saveHistory(history) {
    try {
        ensureDir(path.dirname(HISTORY_PATH));
        const cleaned = [...new Set(history.filter(l => l && l.trim()))].slice(-MAX_HISTORY);
        fs.writeFileSync(HISTORY_PATH, cleaned.join('\n'));
    } catch (error) {
        // Игнорируем ошибки сохранения истории
    }
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ==================== КЛАСС REPL (СЕРДЦЕ СИСТЕМЫ) ====================
class VladXRepl {
    constructor(engine, options = {}) {
        this.engine = engine;
        this.debug = options.debug || false;
        this.reset();
    }

    reset() {
        this.buffer = '';
        this.depth = { braces: 0, parens: 0, brackets: 0 };
        this.inString = false;
        this.stringChar = null;
        this.escapeNext = false;
        this.isMultiline = false;
        this.executionCount = 0;
        // Не очищаем history - readline internally хранит её
        // this.history = [];
    }

    /**
     * Проверка, завершен ли ввод кода
     */
    isCodeComplete() {
        // Быстрая проверка: все скобки закрыты и нет незакрытой строки
        const complete = this.depth.braces === 0 && 
                        this.depth.parens === 0 && 
                        this.depth.brackets === 0 && 
                        !this.inString;
        
        // Дополнительная проверка: буфер не должен быть пустым
        if (complete && this.buffer.trim().length === 0) {
            return false;
        }
        
        return complete;
    }

    /**
     * Анализ строки на предмет скобок и строк
     */
    analyzeLine(line) {
        // Предварительная проверка на максимальный размер
        if (this.buffer.length + line.length > MAX_BUFFER_SIZE) {
            throw new Error(`Превышен максимальный размер буфера: ${MAX_BUFFER_SIZE} символов`);
        }

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            // Обработка escape-последовательностей
            if (this.escapeNext) {
                this.escapeNext = false;
                continue;
            }

            if (char === '\\') {
                this.escapeNext = true;
                continue;
            }

            // Строковые литералы
            if (!this.inString && (char === '"' || char === "'" || char === '`')) {
                this.inString = true;
                this.stringChar = char;
            } else if (this.inString && char === this.stringChar) {
                this.inString = false;
                this.stringChar = null;
            }

            // Скобки (только вне строк)
            if (!this.inString) {
                switch (char) {
                    case '{': this.depth.braces++; break;
                    case '(': this.depth.parens++; break;
                    case '[': this.depth.brackets++; break;
                    case '}': this.depth.braces = Math.max(0, this.depth.braces - 1); break;
                    case ')': this.depth.parens = Math.max(0, this.depth.parens - 1); break;
                    case ']': this.depth.brackets = Math.max(0, this.depth.brackets - 1); break;
                }
            }
        }
    }

    /**
     * Получить текущий промпт
     */
    getPrompt() {
        if (!this.isMultiline) {
            return '\x1b[36mvladx\x1b[0m \x1b[33m»\x1b[0m ';
        }
        
        const level = this.depth.braces + this.depth.parens + this.depth.brackets;
        const dots = '··'.repeat(Math.max(1, level));
        return `\x1b[90m${dots}\x1b[0m `;
    }

    /**
     * Запуск REPL
     */
    async start() {
        const readline = await import('readline');
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            completer: (line) => {
                const hits = this.history.filter(h => h.startsWith(line));
                if (hits.length > 0) {
                    return [hits, line];
                }
                return [[], line];
            },
            history: this.history,
            historySize: MAX_HISTORY
        });
        
        this.rl.on('line', this.handleLine.bind(this));
        this.rl.on('close', this.onClose.bind(this));
        this.rl.on('SIGINT', this.onSigint.bind(this));
        
        console.log(`\x1b[32mVladX v${VERSION}\x1b[0m — Интерпретируемый язык программирования с русским синтаксисом`);
        console.log('Введите "помощь" для получения справки или "выход" для выхода.\n');
        
        this.rl.setPrompt(this.getPrompt());
        this.rl.prompt();
    }

    /**
     * Обработка строки ввода
     */
    async handleLine(line) {
        const trimmed = line.trim();

        // Специальные команды (только в начале)
        if (!this.buffer) {
            if (trimmed === 'выход' || trimmed === 'exit' || trimmed === 'quit') {
                return this.exit();
            }

            if (trimmed === 'помощь' || trimmed === 'help') {
                console.log(`\nКоманды REPL:
  помощь     - показать справку
  выход      - выйти из REPL
  .clear     - очистить буфер многострочного ввода
  Ctrl+C     - прервать ввод или выйти

Синтаксис:
  пусть x = 5
  объект = { имя: "Влад", возраст: 25 }
  функция привет(имя) { вернуть "Привет, " + имя }
  класс Человек { конструктор(имя) { это.имя = имя } }
  если (x > 0) { печать("положительно") } иначе { печать("отрицательно") }
  пока (i < 10) { i = i + 1 }
  для (пусть i = 0; i < 5; i = i + 1) { печать(i) }
`);
                this.rl.prompt();
                return;
            }
        }

        if (trimmed === '.clear') {
            const wasMultiline = this.isMultiline;
            this.reset();
            
            if (wasMultiline) {
                console.log('\x1b[90mМногострочный ввод очищен\x1b[0m');
            } else {
                console.log('\x1b[90mБуфер очищен\x1b[0m');
            }
            this.rl.setPrompt('\x1b[36mvladx\x1b[0m \x1b[33m»\x1b[0m ');
            this.rl.prompt();
            return;
        }

        // Анализируем строку
        try {
            this.analyzeLine(line);
        } catch (e) {
            console.error('\n\x1b[31m❌ Ошибка:\x1b[0m', e.message);
            this.reset();
            this.rl.setPrompt('\x1b[36mvladx\x1b[0m \x1b[33m»\x1b[0m ');
            this.rl.prompt();
            return;
        }

        // Добавляем в буфер
        this.buffer += line + '\n';

        // Проверяем, завершен ли код
        if (this.isCodeComplete()) {
            if (this.buffer.trim()) {
                // Выполняем
                try {
                    this.executionCount++;
                    const result = await this.engine.execute(this.buffer, { filename: `<repl:${this.executionCount}>` });
                    
                    if (result && result.type !== 'null' && result.value !== undefined) {
                        console.log(' \x1b[90m→\x1b[0m', JSON.stringify(result.value, null, 2));
                    }
                } catch (error) {
                    console.error('\n\x1b[31m❌ Ошибка:\x1b[0m', error.toString ? error.toString() : String(error));
                }
            }
            
            // Сбрасываем состояние
            this.reset();
            this.rl.setPrompt('\x1b[36mvladx\x1b[0m \x1b[33m»\x1b[0m ');
        } else {
            // Продолжаем многострочный ввод
            if (!this.isMultiline) {
                this.isMultiline = true;
            }
            this.rl.setPrompt(this.getPrompt());
        }

        this.rl.prompt();
    }

    onClose() {
        saveHistory(this.history);
        console.log('\n\x1b[90mДо встречи!\x1b[0m\n');
        process.exit(0);
    }

    onSigint() {
        if (this.buffer) {
            console.log('\n\x1b[90m(прервано)\x1b[0m');
            this.reset();
            this.rl.setPrompt('\x1b[36mvladx\x1b[0m \x1b[33m»\x1b[0m ');
            this.rl.prompt();
        } else {
            this.exit();
        }
    }

    exit() {
        saveHistory(this.history);
        console.log('\n\x1b[90mВыход...\x1b[0m\n');
        process.exit(0);
    }
}

// ==================== ОСТАЛЬНЫЕ РЕЖИМЫ РАБОТЫ ====================
async function runFile(filepath, args = []) {
    if (!fs.existsSync(filepath)) {
        console.error(`❌ Ошибка: Файл не найден: ${filepath}`);
        process.exit(1);
    }
    
    const source = fs.readFileSync(filepath, 'utf-8');
    
    try {
        const startTime = Date.now();
        const result = await engine.execute(source, {
            filename: filepath,
            modulePath: path.dirname(filepath)
        });
        const duration = Date.now() - startTime;
        
        console.log(`\n\x1b[90mВыполнено за ${duration}мс\x1b[0m`);
    } catch (error) {
        let errorMessage = error.toString ? error.toString() : String(error);
        if (!errorMessage) {
            errorMessage = `Ошибка типа: ${error.constructor.name}`;
            if (error.stack) {
                errorMessage += `\nСтек вызовов: ${error.stack}`;
            } else {
                errorMessage += ' (Стек вызовов недоступен)';
            }
        }
        console.error('\n\x1b[31m❌ Ошибка выполнения:\x1b[0m', errorMessage);
        if (error.stack) {
            console.error('\nСтек вызовов:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

async function executeCode(code) {
    try {
        await engine.execute(code, {
            filename: '<eval>',
            modulePath: process.cwd()
        });
    } catch (error) {
        let errorMessage = error.toString ? error.toString() : String(error);
        if (!errorMessage) {
            errorMessage = `Ошибка типа: ${error.constructor.name}`;
            if (error.stack) {
                errorMessage += `\nСтек вызовов: ${error.stack}`;
            } else {
                errorMessage += ' (Стек вызовов недоступен)';
            }
        }
        console.error('❌ Ошибка:', errorMessage);
        if (error.stack) {
            console.error('\nСтек вызовов:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

async function compileFile(inputPath, outputPath = null) {
    if (!fs.existsSync(inputPath)) {
        console.error(`❌ Ошибка: Файл не найден: ${inputPath}`);
        process.exit(1);
    }
    
    const source = fs.readFileSync(inputPath, 'utf-8');
    
    try {
        const jsCode = engine.compile(source);
        
        if (outputPath) {
            fs.writeFileSync(outputPath, jsCode, 'utf-8');
            console.log(`✅ Скомпилировано в: ${outputPath}`);
        } else {
            console.log(jsCode);
        }
    } catch (error) {
        console.error('❌ Ошибка компиляции:', error.toString ? error.toString() : String(error));
        process.exit(1);
    }
}

// ==================== ГЛАВНАЯ ФУНКЦИЯ ====================
async function main() {
    const options = parseCommandLine(process.argv);
    
    // Настройка движка
    engine.debug = options.debug;
    engine.maxExecutionTime = options.timeout;

    switch (options.mode) {
        case 'eval':
            await executeCode(options.evalCode);
            break;
        case 'compile':
            await compileFile(options.compile, options.outputPath);
            break;
        case 'file':
            await runFile(options.file, options.programArgs);
            break;
        case 'repl':
        default:
            const repl = new VladXRepl(engine);
            await repl.start();
            break;
    }
}

// ==================== ЗАПУСК ====================
main().catch(error => {
    let errorMessage = error.toString ? error.toString() : String(error);
    if (!errorMessage) {
        errorMessage = `Ошибка типа: ${error.constructor.name}`;
        if (error.stack) {
            errorMessage += `\nСтек вызовов: ${error.stack}`;
        } else {
            errorMessage += ' (Стек вызовов недоступен)';
        }
    }
    console.error('\n❌ Критическая ошибка:', errorMessage);
    if (error.stack) {
        console.error('\nСтек вызовов:');
        console.error(error.stack);
    }
    process.exit(1);
});
