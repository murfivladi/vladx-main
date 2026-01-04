/**
 * REPL — Улучшенная интерактивная консоль
 */

import { VladXObject } from './vladx-object.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export class REPL {
    constructor(engine, options = {}) {
        this.engine = engine;
        this.input = options.input || process.stdin;
        this.output = options.output || process.stdout;
        this.history = [];
        this.historyIndex = -1;
        this.historyFile = options.historyFile || join(process.env.HOME || process.env.USERPROFILE || '', '.vladx_history');
        this.maxHistorySize = options.maxHistorySize || 1000;
        this.prompt = options.prompt || 'vladx> ';
        this.multilinePrompt = options.multilinePrompt || '... ';
        this.specialCommands = {
            '.clear': this.clear.bind(this),
            '.exit': this.exit.bind(this),
            '.help': this.help.bind(this),
            '.history': this.showHistory.bind(this),
            '.load': this.loadFile.bind(this),
            '.save': this.saveFile.bind(this),
            '.debug': this.toggleDebug.bind(this),
            '.profile': this.toggleProfile.bind(this),
            '.version': this.version.bind(this)
        };
        this.debugMode = false;
        this.profileMode = false;
        this.context = {};
    }

    /**
     * Запустить REPL
     */
    async start() {
        const readline = await import('readline');
        this.rl = readline.createInterface({
            input: this.input,
            output: this.output,
            prompt: this.prompt
        });

        this.loadHistory();

        this.rl.on('line', async (line) => {
            await this.handleInput(line.trim());
        });

        this.rl.on('close', () => {
            this.saveHistory();
            this.output.write('\nДо встречи!\n');
        });

        this.rl.on('SIGINT', () => {
            this.output.write('^C\n');
            this.rl.prompt();
        });

        this.rl.setPrompt(this.prompt);
        this.rl.prompt();
    }

    /**
     * Обработка ввода
     */
    async handleInput(line) {
        if (!line) {
            this.rl.prompt();
            return;
        }

        // Специальные команды
        if (line.startsWith('.')) {
            await this.handleSpecialCommand(line);
            return;
        }

        // История (стрелки вверх/вниз)
        if (line === '\x1B[A') { // Up arrow
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                this.rl.write(null, { ctrl: true, name: 'u' });
                this.rl.write(this.history[this.history.length - 1 - this.historyIndex]);
            }
            return;
        }

        if (line === '\x1B[B') { // Down arrow
            if (this.historyIndex > -1) {
                this.historyIndex--;
                this.rl.write(null, { ctrl: true, name: 'u' });
                if (this.historyIndex >= 0) {
                    this.rl.write(this.history[this.history.length - 1 - this.historyIndex]);
                }
            }
            return;
        }

        // Добавить в историю
        this.addToHistory(line);
        this.historyIndex = -1;

        // Выполнить код
        try {
            const result = await this.engine.execute(line, {
                filename: '<repl>',
                context: this.context
            });

            if (result !== undefined) {
                this.output.write(`→ ${this.formatResult(result)}\n`);
            }
        } catch (error) {
            this.output.write(`\x1b[31mОшибка:\x1b[0m ${this.formatError(error)}\n`);
        }

        this.rl.prompt();
    }

    /**
     * Обработка специальных команд
     */
    async handleSpecialCommand(line) {
        const parts = line.split(' ');
        const command = parts[0];
        const args = parts.slice(1);

        if (this.specialCommands[command]) {
            try {
                await this.specialCommands[command](...args);
            } catch (error) {
                this.output.write(`\x1b[31mОшибка:\x1b[0m ${error.message}\n`);
            }
        } else {
            this.output.write(`Неизвестная команда: ${command}. Введите .help для справки.\n`);
        }

        this.rl.prompt();
    }

    /**
     * Очистить контекст
     */
    clear() {
        this.context = {};
        this.output.write('Контекст очищен.\n');
    }

    /**
     * Выйти из REPL
     */
    exit() {
        this.saveHistory();
        this.rl.close();
    }

    /**
     * Показать справку
     */
    help() {
        const helpText = `
Доступные команды:
  .clear     Очистить контекст REPL
  .exit      Выйти из REPL
  .help      Показать эту справку
  .history   Показать историю команд
  .load [файл] Загрузить и выполнить файл
  .save [файл] Сохранить контекст в файл
  .debug     Включить/выключить отладочный режим
  .profile   Включить/выключить профилирование
  .version   Показать версию VladX

Используйте стрелки ↑↓ для навигации по истории.
        `.trim();
        this.output.write(helpText + '\n');
    }

    /**
     * Показать историю
     */
    showHistory() {
        this.output.write('История команд:\n');
        this.history.forEach((line, i) => {
            this.output.write(`  ${i + 1}: ${line}\n`);
        });
    }

    /**
     * Загрузить файл
     */
    async loadFile(filename) {
        try {
            const result = await this.engine.executeFile(filename);
            this.output.write(`Загружен файл: ${filename}\n`);
            if (result !== undefined) {
                this.output.write(`→ ${this.formatResult(result)}\n`);
            }
        } catch (error) {
            this.output.write(`\x1b[31mОшибка загрузки файла:\x1b[0m ${error.message}\n`);
        }
    }

    /**
     * Сохранить контекст
     */
    saveFile(filename) {
        try {
            const content = JSON.stringify(this.context, null, 2);
            require('fs').writeFileSync(filename, content, 'utf-8');
            this.output.write(`Контекст сохранен в: ${filename}\n`);
        } catch (error) {
            this.output.write(`\x1b[31mОшибка сохранения:\x1b[0m ${error.message}\n`);
        }
    }

    /**
     * Переключить отладочный режим
     */
    toggleDebug() {
        this.debugMode = !this.debugMode;
        this.engine.debug = this.debugMode;
        this.output.write(`Отладочный режим: ${this.debugMode ? 'включен' : 'выключен'}\n`);
    }

    /**
     * Переключить профилирование
     */
    toggleProfile() {
        this.profileMode = !this.profileMode;
        this.output.write(`Профилирование: ${this.profileMode ? 'включено' : 'выключено'}\n`);
    }

    /**
     * Показать версию
     */
    version() {
        this.output.write('VladX 1.0.0\n');
    }

    /**
     * Добавить в историю
     */
    addToHistory(line) {
        if (line.length === 0) return;

        // Дубликаты не добавляем
        if (this.history.length > 0 && this.history[this.history.length - 1] === line) {
            return;
        }

        this.history.push(line);

        // Ограничение размера
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * Загрузить историю из файла
     */
    loadHistory() {
        try {
            if (existsSync(this.historyFile)) {
                const content = readFileSync(this.historyFile, 'utf-8');
                this.history = content.split('\n').filter(line => line.length > 0);
            }
        } catch (error) {
            // Игнорируем ошибки загрузки истории
        }
    }

    /**
     * Сохранить историю в файл
     */
    saveHistory() {
        try {
            require('fs').writeFileSync(this.historyFile, this.history.join('\n'), 'utf-8');
        } catch (error) {
            // Игнорируем ошибки сохранения истории
        }
    }

    /**
     * Форматировать результат
     */
    formatResult(result) {
        if (result === null || result === undefined) {
            return 'ничто';
        }

        if (result && result.type !== undefined) {
            return result.toString();
        }

        if (typeof result === 'object') {
            return JSON.stringify(result, null, 2);
        }

        return String(result);
    }

    /**
     * Форматировать ошибку
     */
    formatError(error) {
        if (error.stack) {
            return error.stack;
        }
        return error.message || String(error);
    }

    /**
     * Установить пользовательский промпт
     */
    setPrompt(prompt) {
        this.prompt = prompt;
        this.rl.setPrompt(prompt);
    }

    /**
     * Остановить REPL
     */
    stop() {
        if (this.rl) {
            this.saveHistory();
            this.rl.close();
        }
    }
}

export default REPL;
