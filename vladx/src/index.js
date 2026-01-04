/**
 * VladX - Основной файл экспорта
 */

export { VladXEngine } from './engine/vladx-engine.js';
export { JITCompiler } from './engine/jit-compiler.js';

export { Lexer, OptimizedLexer } from './lexer/lexer.js';
export { RegexCache } from './lexer/regex-cache.js';

export { Parser } from './parser/parser.js';
export * from './parser/ast-nodes.js';

export { Interpreter } from './interpreter/interpreter.js';

export { Environment } from './runtime/environment.js';
export { TypeSystem, AdvancedTypeSystem } from './runtime/type-system.js';
export { VladXObject, types } from './runtime/vladx-object.js';
export { Builtins } from './runtime/builtins.js';
export { ModuleSystem } from './runtime/module-system.js';
export { EnhancedModuleSystem } from './runtime/enhanced-module-system.js';

export { CacheManager } from './runtime/cache-manager.js';
export { SecurityManager } from './runtime/security-manager.js';
export { Debugger } from './runtime/debugger.js';
export { Profiler } from './runtime/profiler.js';
export { REPL } from './runtime/repl.js';
export { AsyncManager } from './runtime/async-manager.js';
export { Functional } from './runtime/functional.js';
export DataStructures from './runtime/data-structures.js';
export { TestRunner } from './runtime/test-runner.js';
export { Bundle } from './runtime/bundler.js';
export { Minifier } from './runtime/minifier.js';
export { Transformer } from './runtime/transformer.js';
export { SourceMapGenerator } from './runtime/source-map-generator.js';
export { IOOperations } from './runtime/io-operations.js';
export { NetworkOperations } from './runtime/network-operations.js';
export { EnvironmentEnhanced } from './runtime/environment-enhanced.js';
export { EventEmitter } from './runtime/event-emitter.js';
export { Linter } from './runtime/linter.js';
export { Formatter } from './runtime/formatter.js';
export { Logging } from './runtime/logging.js';

export { default as default } from './engine/vladx-engine.js';
