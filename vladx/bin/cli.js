/**
 * CLI — Интерфейс командной строки для VladX
 */

import { VladXEngine } from './vladx-engine.js';
import { Linter } from './runtime/linter.js';
import { Formatter } from './runtime/formatter.js';
import { Logging } from './runtime/logging.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = new Logging({ level: 'info' });

export class CLI {
    constructor() {
        this.engine = null;
        this.commands = new Map();
        this.registerCommands();
    }

    /**
     * Регистрация команд
     */
    registerCommands() {
        this.commands.set('run', this.run.bind(this));
        this.commands.set('repl', this.repl.bind(this));
        this.commands.set('compile', this.compile.bind(this));
        this.commands.set('lint', this.lint.bind(this));
        this.commands.set('format', this.format.bind(this));
        this.commands.set('test', this.test.bind(this));
        this.commands.set('bundle', this.bundle.bind(this));
        this.commands.set('watch', this.watch.bind(this));
        this.commands.set('debug', this.debug.bind(this));
        this.commands.set('help', this.help.bind(this));
    }

    /**
     * Запуск CLI
     */
    async runCLI(argv = process.argv) {
        const command = argv[2];
        const args = argv.slice(3);

        if (!command || !this.commands.has(command)) {
            this.help();
            return;
        }

        const cmd = this.commands.get(command);

        try {
            await cmd(args);
        } catch (error) {
            logger.error(`Ошибка: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Выполнить файл
     */
    async run(args) {
        if (args.length === 0) {
            logger.error('Укажите файл для выполнения');
            return;
        }

        const filepath = resolve(args[0]);
        const options = this.parseOptions(args.slice(1));

        if (!existsSync(filepath)) {
            throw new Error(`Файл не найден: ${filepath}`);
        }

        const startTime = Date.now();
        this.engine = new VladXEngine({
            debug: options.debug || false,
            strictMode: options.strict || false,
            maxExecutionTime: options.timeout || 30000,
            cache: options.cache,
            security: options.security
        });

        try {
            const result = await this.engine.executeFile(filepath);

            if (options.time) {
                const duration = Date.now() - startTime;
                logger.info(`Время выполнения: ${duration}ms`);
            }

            if (result !== undefined && !options.silent) {
                logger.info('Результат:', result);
            }

            process.exit(0);
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    }

    /**
     * REPL режим
     */
    async repl(args) {
        const options = this.parseOptions(args);

        this.engine = new VladXEngine({
            debug: options.debug || false,
            cache: options.cache,
            security: options.security
        });

        await this.engine.repl();
    }

    /**
     * Компиляция
     */
    async compile(args) {
        if (args.length === 0) {
            logger.error('Укажите файл для компиляции');
            return;
        }

        const filepath = resolve(args[0]);
        const options = this.parseOptions(args.slice(1));

        if (!existsSync(filepath)) {
            throw new Error(`Файл не найден: ${filepath}`);
        }

        this.engine = new VladXEngine();

        const jsCode = this.engine.compile(readFileSync(filepath, 'utf-8'));

        let output = options.output || filepath.replace(/\.vx$/, '.js');

        if (options.format === 'cjs') {
            jsCode = `"use strict";\n${jsCode}`;
        }

        writeFileSync(output, jsCode, 'utf-8');
        logger.info(`Скомпилировано: ${filepath} -> ${output}`);
    }

    /**
     * Линтинг
     */
    async lint(args) {
        if (args.length === 0) {
            logger.error('Укажите файл для линтинга');
            return;
        }

        const filepath = resolve(args[0]);
        const options = this.parseOptions(args.slice(1));

        if (!existsSync(filepath)) {
            throw new Error(`Файл не найден: ${filepath}`);
        }

        const linter = new Linter({
            autoFix: options.fix || false,
            config: options.config
        });

        const source = readFileSync(filepath, 'utf-8');
        const results = linter.lint(source, filepath);

        if (options.fix && results.all.length > 0) {
            const fixed = linter.fix(source, filepath);
            if (fixed.fixed) {
                writeFileSync(filepath, fixed.source, 'utf-8');
                logger.info('Автофикс применен');
            }
        }

        if (results.hasErrors) {
            logger.error('Найдены ошибки:');
            results.errors.forEach(err => {
                logger.error(`  ${filepath}:${err.line}:${err.column} - ${err.message}`);
            });
            process.exit(1);
        }

        if (results.warnings.length > 0) {
            logger.warn('Предупреждения:');
            results.warnings.forEach(warn => {
                logger.warn(`  ${filepath}:${warn.line}:${warn.column} - ${warn.message}`);
            });
        }

        if (results.all.length === 0) {
            logger.info('Проблем не найдено');
        }

        process.exit(0);
    }

    /**
     * Форматирование
     */
    async format(args) {
        if (args.length === 0) {
            logger.error('Укажите файл для форматирования');
            return;
        }

        const filepath = resolve(args[0]);
        const options = this.parseOptions(args.slice(1));

        if (!existsSync(filepath)) {
            throw new Error(`Файл не найден: ${filepath}`);
        }

        const formatter = new Formatter({
            indentSize: options.indent || 4,
            useTabs: options.tabs || false,
            printWidth: options.width || 100
        });

        const source = readFileSync(filepath, 'utf-8');
        const formatted = formatter.format(source, filepath);

        writeFileSync(filepath, formatted, 'utf-8');
        logger.info(`Отформатировано: ${filepath}`);
    }

    /**
     * Тесты
     */
    async test(args) {
        const TestRunner = await import('./runtime/test-runner.js');
        const runner = new TestRunner.default();

        const filepath = args[0] ? resolve(args[0]) : null;

        if (filepath) {
            if (!existsSync(filepath)) {
                throw new Error(`Файл не найден: ${filepath}`);
            }

            const source = readFileSync(filepath, 'utf-8');
            await this.engine.execute(source, { filename: filepath });
        } else {
            const files = this.findTestFiles();

            for (const file of files) {
                const source = readFileSync(file, 'utf-8');
                await this.engine.execute(source, { filename: file });
            }
        }

        const results = await runner.run();

        if (results.failed > 0) {
            logger.error(`Тесты провалены: ${results.failed}/${results.total}`);
            process.exit(1);
        }

        logger.info(`Тесты пройдены: ${results.passed}/${results.total}`);
        process.exit(0);
    }

    /**
     * Сборка модулей
     */
    async bundle(args) {
        if (args.length === 0) {
            logger.error('Укажите точку входа');
            return;
        }

        const entry = resolve(args[0]);
        const options = this.parseOptions(args.slice(1));

        if (!existsSync(entry)) {
            throw new Error(`Файл не найден: ${entry}`);
        }

        const { Bundle } = await import('./runtime/bundler.js');
        const bundler = new Bundle({
            entry,
            output: options.output || 'bundle.vx',
            format: options.format || 'esm',
            minify: options.minify || false,
            sourceMap: options.sourcemap || false
        });

        const bundled = await bundler.build();
        await bundler.write(bundled);

        logger.info(`Собрано: ${bundled.modules} модулей -> ${bundler.output}`);
    }

    /**
     * Watch режим
     */
    async watch(args) {
        if (args.length === 0) {
            logger.error('Укажите файл для слежения');
            return;
        }

        const filepath = resolve(args[0]);
        const options = this.parseOptions(args.slice(1));

        if (!existsSync(filepath)) {
            throw new Error(`Файл не найден: ${filepath}`);
        }

        logger.info(`Слежение за: ${filepath}`);

        this.engine = new VladXEngine({
            debug: options.debug || false
        });

        const runFile = async () => {
            try {
                await this.engine.executeFile(filepath);
            } catch (error) {
                logger.error(error.message);
            }
        };

        await runFile();

        const fs = await import('fs');
        fs.watchFile(filepath, { interval: options.interval || 1000 }, async () => {
            logger.info('Файл изменен, перезапуск...');
            await runFile();
        });
    }

    /**
     * Отладка
     */
    async debug(args) {
        if (args.length === 0) {
            logger.error('Укажите файл для отладки');
            return;
        }

        const filepath = resolve(args[0]);

        if (!existsSync(filepath)) {
            throw new Error(`Файл не найден: ${filepath}`);
        }

        this.engine = new VladXEngine({
            debug: true
        });

        logger.info('Отладочный режим включен');
        logger.info('Команды: точкаОстанова, пошаговыйРежим, продолжить');

        await this.engine.executeFile(filepath);
    }

    /**
     * Справка
     */
    help() {
        console.log(`
VladX - Мощный интерпретируемый язык программирования

Использование:
  vladx <команда> [опции] [аргументы]

Команды:
  run <файл>        Выполнить файл
  repl               Интерактивная консоль
  compile <файл>    Скомпилировать в JavaScript
  lint <файл>        Проверить код на ошибки
  format <файл>      Отформатировать код
  test [файл]        Запустить тесты
  bundle <entry>     Собрать модули
  watch <файл>       Смотреть за изменениями файла
  debug <файл>       Отладочный режим
  help               Показать эту справку

Опции:
  --debug            Режим отладки
  --strict           Строгий режим
  --timeout <ms>     Таймаут выполнения
  --output <file>    Файл вывода
  --format <format>  Формат (esm, cjs, iife, umd)
  --minify           Минифицировать
  --fix              Автофикс для линтера
  --watch            Смотреть за изменениями
  --time             Показать время выполнения
  --silent           Без вывода результатов
  --indent <n>       Размер отступа
  --tabs             Использовать табы
  --width <n>        Максимальная ширина строки

Примеры:
  vladx run main.vx
  vladx repl
  vladx compile main.vx --output main.js
  vladx lint main.vx --fix
  vladx format main.vx --indent 2
  vladx bundle main.vx --format iife --minify
  vladx watch main.vx
  vladx debug main.vx

Документация: https://vladx.dev
        `.trim());
    }

    /**
     * Парсинг опций
     */
    parseOptions(args) {
        const options = {};

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg === '--debug') {
                options.debug = true;
            } else if (arg === '--strict') {
                options.strict = true;
            } else if (arg === '--timeout' && args[i + 1]) {
                options.timeout = parseInt(args[++i]);
            } else if (arg === '--output' && args[i + 1]) {
                options.output = args[++i];
            } else if (arg === '--format' && args[i + 1]) {
                options.format = args[++i];
            } else if (arg === '--minify') {
                options.minify = true;
            } else if (arg === '--fix') {
                options.fix = true;
            } else if (arg === '--watch') {
                options.watch = true;
            } else if (arg === '--time') {
                options.time = true;
            } else if (arg === '--silent') {
                options.silent = true;
            } else if (arg === '--indent' && args[i + 1]) {
                options.indent = parseInt(args[++i]);
            } else if (arg === '--tabs') {
                options.tabs = true;
            } else if (arg === '--width' && args[i + 1]) {
                options.width = parseInt(args[++i]);
            }
        }

        return options;
    }

    /**
     * Найти тестовые файлы
     */
    findTestFiles() {
        const fs = require('fs');
        const path = require('path');

        const testFiles = [];

        const findFiles = (dir) => {
            const files = fs.readdirSync(dir);

            for (const file of files) {
                const filepath = path.join(dir, file);
                const stat = fs.statSync(filepath);

                if (stat.isDirectory()) {
                    if (file === 'node_modules' || file.startsWith('.')) continue;
                    findFiles(filepath);
                } else if (file.endsWith('.test.vx') || file.endsWith('.spec.vx')) {
                    testFiles.push(filepath);
                }
            }
        };

        findFiles(process.cwd());
        return testFiles;
    }
}

export default CLI;
