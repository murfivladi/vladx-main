/**
 * VladX — Мощный интерпретируемый язык программирования
 * Написан полностью на Node.js с русским синтаксисом
 * 
 * Автор: VladX Team
 * Лицензия: MIT
 */

// Основной экспорт — точка входа в язык
export { VladXEngine } from './engine/vladx-engine.js';
export { Lexer } from './lexer/lexer.js';
export { Parser } from './parser/parser.js';
export { Interpreter } from './interpreter/interpreter.js';
export { ASTNodes } from './parser/ast-nodes.js';
export { Environment } from './runtime/environment.js';
export { VladXObject, types } from './runtime/vladx-object.js';
export { Builtins } from './runtime/builtins.js';
export { ModuleSystem } from './runtime/module-system.js';

// Версия движка
export const VERSION = '1.0.0';
export const LANGUAGE_NAME = 'VladX';
