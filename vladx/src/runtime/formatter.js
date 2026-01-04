/**
 * Formatter — Форматирование кода VladX
 */

import { Lexer } from '../lexer/lexer.js';
import { Parser } from '../parser/parser.js';

export class Formatter {
    constructor(options = {}) {
        this.indentSize = options.indentSize || 4;
        this.indentChar = options.indentChar || ' ';
        this.useTabs = options.useTabs || false;
        this.semicolons = options.semicolons !== false;
        this.trailingComma = options.trailingComma || false;
        this.singleQuote = options.singleQuote || false;
        this.printWidth = options.printWidth || 100;
        this.insertFinalNewline = options.insertFinalNewline !== false;
    }

    /**
     * Отформатировать код
     */
    format(source, filename = '<anonymous>') {
        let formatted = source;

        // Шаг 1: Нормализация пробелов
        formatted = this.normalizeWhitespace(formatted);

        // Шаг 2: Форматирование блоков
        formatted = this.formatBlocks(formatted);

        // Шаг 3: Форматирование отступов
        formatted = this.formatIndentation(formatted);

        // Шаг 4: Форматирование операторов
        formatted = this.formatOperators(formatted);

        // Шаг 5: Удаление лишних пустых строк
        formatted = this.formatEmptyLines(formatted);

        // Шаг 6: Добавление перевода строки в конце
        if (this.insertFinalNewline && !formatted.endsWith('\n')) {
            formatted += '\n';
        }

        return formatted;
    }

    /**
     * Нормализация пробелов
     */
    normalizeWhitespace(source) {
        // Удалить trailing whitespace
        let formatted = source.split('\n').map(line => line.trimEnd()).join('\n');

        // Нормализировать табы в пробелы или наоборот
        if (this.useTabs) {
            formatted = formatted.replace(/ {4}/g, '\t');
        } else {
            formatted = formatted.replace(/\t/g, ' '.repeat(this.indentSize));
        }

        return formatted;
    }

    /**
     * Форматирование блоков
     */
    formatBlocks(source) {
        let formatted = source;

        // Форматирование if/else
        formatted = formatted.replace(
            /(?:если|if)\s*\(([^)]*)\)\s*([^{])/g,
            (match, condition, nextChar) => {
                const indent = ' '.repeat(this.indentSize);
                return `если (${condition}) {\n${indent}${nextChar}`;
            }
        );

        // Форматирование while
        formatted = formatted.replace(
            /(?:пока|while)\s*\(([^)]*)\)\s*([^{])/g,
            (match, condition, nextChar) => {
                const indent = ' '.repeat(this.indentSize);
                return `пока (${condition}) {\n${indent}${nextChar}`;
            }
        );

        // Форматирование for
        formatted = formatted.replace(
            /(?:для|for)\s*\(([^)]*)\)\s*([^{])/g,
            (match, condition, nextChar) => {
                const indent = ' '.repeat(this.indentSize);
                return `для (${condition}) {\n${indent}${nextChar}`;
            }
        );

        return formatted;
    }

    /**
     * Форматирование отступов
     */
    formatIndentation(source) {
        const lines = source.split('\n');
        const formattedLines = [];
        let indentLevel = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.length === 0) {
                formattedLines.push('');
                continue;
            }

            // Уменьшить отступ перед закрывающей скобкой
            if (trimmed.startsWith('}') || trimmed.startsWith('иначе')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            // Добавить отступ
            const indent = this.useTabs
                ? '\t'.repeat(indentLevel)
                : ' '.repeat(indentLevel * this.indentSize);
            formattedLines.push(indent + trimmed);

            // Увеличить отступ после открывающей скобки
            if (trimmed.endsWith('{')) {
                indentLevel++;
            }
        }

        return formattedLines.join('\n');
    }

    /**
     * Форматирование операторов
     */
    formatOperators(source) {
        let formatted = source;

        // Пробелы вокруг операторов
        const operators = ['+', '-', '*', '/', '%', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '!'];

        for (const op of operators) {
            formatted = formatted.replace(
                new RegExp(`([^\\s])\\${op}([^\\s])`, 'g'),
                `$1 ${op} $2`
            );
        }

        // Пробелы после запятых
        formatted = formatted.replace(/,(\S)/g, ', $1');

        // Пробелы после точек с запятой
        formatted = formatted.replace(/;(\S)/g, '; $1');

        return formatted;
    }

    /**
     * Форматирование пустых строк
     */
    formatEmptyLines(source) {
        const lines = source.split('\n');
        const formattedLines = [];
        let emptyCount = 0;

        for (const line of lines) {
            if (line.trim().length === 0) {
                emptyCount++;
                if (emptyCount <= 2) {
                    formattedLines.push(line);
                }
            } else {
                emptyCount = 0;
                formattedLines.push(line);
            }
        }

        return formattedLines.join('\n');
    }

    /**
     * Проверить код
     */
    check(source, filename = '<anonymous>') {
        const issues = [];

        // Проверить длину строк
        const lines = source.split('\n');
        lines.forEach((line, index) => {
            if (line.length > this.printWidth) {
                issues.push({
                    message: `Строка слишком длинная: ${line.length} > ${this.printWidth}`,
                    line: index + 1,
                    severity: 'warning'
                });
            }
        });

        // Проверить trailing whitespace
        lines.forEach((line, index) => {
            if (line !== line.trimEnd()) {
                issues.push({
                    message: 'Trailing whitespace в конце строки',
                    line: index + 1,
                    severity: 'info'
                });
            }
        });

        // Проверить смешивание табов и пробелов
        lines.forEach((line, index) => {
            if (line.includes('\t') && line.includes('  ')) {
                issues.push({
                    message: 'Смешивание табов и пробелов',
                    line: index + 1,
                    severity: 'error'
                });
            }
        });

        return {
            issues,
            hasIssues: issues.length > 0
        };
    }

    /**
     * Форматировать с автофиксом
     */
    formatWithFix(source, filename = '<anonymous>') {
        const checkResult = this.check(source, filename);

        if (!checkResult.hasIssues) {
            return {
                source,
                formatted: false,
                issues: []
            };
        }

        const formatted = this.format(source, filename);

        return {
            source: formatted,
            formatted: true,
            issues: checkResult.issues
        };
    }

    /**
     * Получить конфигурацию
     */
    getConfig() {
        return {
            indentSize: this.indentSize,
            indentChar: this.indentChar,
            useTabs: this.useTabs,
            semicolons: this.semicolons,
            trailingComma: this.trailingComma,
            singleQuote: this.singleQuote,
            printWidth: this.printWidth,
            insertFinalNewline: this.insertFinalNewline
        };
    }

    /**
     * Установить конфигурацию
     */
    setConfig(config) {
        Object.assign(this, config);
        return this;
    }
}

export default Formatter;
