/**
 * Linter — Линтер для кода VladX
 */

import { Lexer } from '../lexer/lexer.js';
import { Parser } from '../parser/parser.js';

export class Linter {
    constructor(options = {}) {
        this.rules = new Map();
        this.config = options.config || {};
        this.severity = options.severity || 'error'; // error, warning, info
        this.autoFix = options.autoFix || false;

        this.registerDefaultRules();
    }

    /**
     * Добавить правило
     */
    addRule(name, rule) {
        this.rules.set(name, rule);
        return this;
    }

    /**
     * Удалить правило
     */
    removeRule(name) {
        return this.rules.delete(name);
    }

    /**
     * Проверить файл
     */
    lint(source, filename = '<anonymous>') {
        const results = [];

        // Лексический анализ
        const lexer = new Lexer(source, filename);
        const tokens = lexer.tokenize();

        // Синтаксический анализ
        const parser = new Parser(tokens);
        const ast = parser.parse();

        // Применить правила
        for (const [ruleName, rule] of this.rules) {
            if (rule.checkTokens) {
                const tokenResults = rule.checkTokens(tokens, filename);
                results.push(...tokenResults.map(r => ({ ...r, rule: ruleName })));
            }

            if (rule.checkAST) {
                const astResults = rule.checkAST(ast, filename);
                results.push(...astResults.map(r => ({ ...r, rule: ruleName })));
            }

            if (rule.checkSource) {
                const sourceResults = rule.checkSource(source, filename);
                results.push(...sourceResults.map(r => ({ ...r, rule: ruleName })));
            }
        }

        return {
            errors: results.filter(r => r.severity === 'error'),
            warnings: results.filter(r => r.severity === 'warning'),
            info: results.filter(r => r.severity === 'info'),
            all: results,
            hasErrors: results.some(r => r.severity === 'error')
        };
    }

    /**
     * Автофикс проблем
     */
    fix(source, filename = '<anonymous>') {
        const results = this.lint(source, filename);
        let fixedSource = source;

        if (!this.autoFix) {
            return {
                source,
                results,
                fixed: false
            };
        }

        for (const [ruleName, rule] of this.rules) {
            if (rule.fix && results.some(r => r.rule === ruleName)) {
                fixedSource = rule.fix(fixedSource, filename);
            }
        }

        const newResults = this.lint(fixedSource, filename);

        return {
            source: fixedSource,
            originalResults: results,
            results: newResults,
            fixed: newResults.all.length < results.all.length
        };
    }

    /**
     * Зарегистрировать правила по умолчанию
     */
    registerDefaultRules() {
        // Правило: unused variables
        this.addRule('no-unused-vars', {
            checkAST: (ast, filename) => {
                const results = [];
                const usedVars = new Set();
                const declaredVars = new Set();

                const traverse = (node) => {
                    if (!node) return;

                    if (node.type === 'LetStatement' || node.type === 'ConstStatement') {
                        declaredVars.add(node.name);
                    }

                    if (node.type === 'Identifier') {
                        usedVars.add(node.name);
                    }

                    for (const key in node) {
                        if (Array.isArray(node[key])) {
                            node[key].forEach(traverse);
                        } else if (typeof node[key] === 'object') {
                            traverse(node[key]);
                        }
                    }
                };

                traverse(ast);

                for (const varName of declaredVars) {
                    if (!usedVars.has(varName)) {
                        results.push({
                            message: `Переменная "${varName}" не используется`,
                            line: ast.body?.[0]?.line || 0,
                            column: 0,
                            severity: 'warning',
                            filename
                        });
                    }
                }

                return results;
            }
        });

        // Правило: console.log в production
        this.addRule('no-console', {
            checkAST: (ast, filename) => {
                const results = [];

                const traverse = (node) => {
                    if (!node) return;

                    if (node.type === 'CallExpression') {
                        if (node.callee === 'печать' || node.callee === 'console.log') {
                            results.push({
                                message: 'Не используйте console.log в production коде',
                                line: node.line || 0,
                                column: 0,
                                severity: 'warning',
                                filename
                            });
                        }
                    }

                    for (const key in node) {
                        if (Array.isArray(node[key])) {
                            node[key].forEach(traverse);
                        } else if (typeof node[key] === 'object') {
                            traverse(node[key]);
                        }
                    }
                };

                traverse(ast);
                return results;
            }
        });

        // Правило: empty blocks
        this.addRule('no-empty-blocks', {
            checkAST: (ast, filename) => {
                const results = [];

                const traverse = (node) => {
                    if (!node) return;

                    if (node.type === 'IfStatement' || node.type === 'WhileStatement') {
                        const body = node.thenBranch?.body || node.body;
                        if (body && body.length === 0) {
                            results.push({
                                message: 'Пустой блок кода',
                                line: node.line || 0,
                                column: 0,
                                severity: 'warning',
                                filename
                            });
                        }
                    }

                    for (const key in node) {
                        if (Array.isArray(node[key])) {
                            node[key].forEach(traverse);
                        } else if (typeof node[key] === 'object') {
                            traverse(node[key]);
                        }
                    }
                };

                traverse(ast);
                return results;
            },
            fix: (source) => {
                return source.replace(/(?:если|if)\s*\([^)]*\)\s*{\s*}/g, '');
            }
        });

        // Правило: trailing whitespace
        this.addRule('no-trailing-whitespace', {
            checkSource: (source, filename) => {
                const results = [];
                const lines = source.split('\n');

                lines.forEach((line, index) => {
                    if (line !== line.trimEnd()) {
                        results.push({
                            message: 'Trailing whitespace в конце строки',
                            line: index + 1,
                            column: line.length,
                            severity: 'info',
                            filename
                        });
                    }
                });

                return results;
            },
            fix: (source) => {
                return source.split('\n').map(line => line.trimEnd()).join('\n');
            }
        });

        // Правило: line length
        this.addRule('max-line-length', {
            checkSource: (source, filename) => {
                const results = [];
                const maxLength = this.config.maxLineLength || 100;
                const lines = source.split('\n');

                lines.forEach((line, index) => {
                    if (line.length > maxLength) {
                        results.push({
                            message: `Строка слишком длинная: ${line.length} > ${maxLength}`,
                            line: index + 1,
                            column: maxLength,
                            severity: 'warning',
                            filename
                        });
                    }
                });

                return results;
            }
        });

        // Правило: no var
        this.addRule('no-var', {
            checkTokens: (tokens, filename) => {
                const results = [];

                tokens.forEach(token => {
                    if (token.type === 'VAR' || token.value === 'переменная') {
                        results.push({
                            message: 'Используйте "пусть" или "константа" вместо "переменная"',
                            line: token.line,
                            column: token.column,
                            severity: 'error',
                            filename
                        });
                    }
                });

                return results;
            }
        });

        // Правило: curly braces
        this.addRule('curly', {
            checkAST: (ast, filename) => {
                const results = [];

                const traverse = (node) => {
                    if (!node) return;

                    if (node.type === 'IfStatement') {
                        const thenBranch = node.thenBranch;
                        if (thenBranch && thenBranch.type !== 'BlockStatement') {
                            results.push({
                                message: 'Используйте фигурные скобки для if блоков',
                                line: node.line || 0,
                                column: 0,
                                severity: 'error',
                                filename
                            });
                        }
                    }

                    for (const key in node) {
                        if (Array.isArray(node[key])) {
                            node[key].forEach(traverse);
                        } else if (typeof node[key] === 'object') {
                            traverse(node[key]);
                        }
                    }
                };

                traverse(ast);
                return results;
            }
        });
    }

    /**
     * Получить результаты в формате JSON
     */
    getResultsJSON(lintResults) {
        return JSON.stringify(lintResults, null, 2);
    }

    /**
     * Получить результаты в формате JUnit
     */
    getResultsJUnit(lintResults) {
        const errors = lintResults.errors;
        const warnings = lintResults.warnings;

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += `<testsuites errors="${errors.length}" failures="0" tests="${errors.length + warnings.length}">\n`;
        xml += '  <testsuite name="VladX Linter">\n';

        for (const error of errors) {
            xml += `    <testcase name="${error.rule}">\n`;
            xml += `      <error message="${error.message}" line="${error.line}"/>\n`;
            xml += '    </testcase>\n';
        }

        for (const warning of warnings) {
            xml += `    <testcase name="${warning.rule}"/>\n`;
        }

        xml += '  </testsuite>\n';
        xml += '</testsuites>';

        return xml;
    }

    /**
     * Очистить правила
     */
    clearRules() {
        this.rules.clear();
        return this;
    }
}

export default Linter;
