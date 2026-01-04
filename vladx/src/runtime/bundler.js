/**
 * Bundle — Сборщик модулей
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, relative } from 'path';

export class Bundle {
    constructor(options = {}) {
        this.entry = options.entry;
        this.output = options.output || 'bundle.vx';
        this.format = options.format || 'esm'; // esm, cjs, iife, umd
        this.minify = options.minify || false;
        this.sourceMap = options.sourceMap || false;
        this.moduleSystem = options.moduleSystem;
        this.analyzed = new Map();
        this.dependencyGraph = new Map();
        this.importStatements = new Set();
    }

    /**
     * Собрать модули в один файл
     */
    async build() {
        if (!this.entry) {
            throw new Error('Entry point is required');
        }

        const modules = await this.analyzeDependencies(this.entry);
        const sorted = this.topologicalSort(modules);
        const bundled = this.generateBundle(sorted);

        if (this.sourceMap) {
            const map = this.generateSourceMap(sorted);
            bundled.sourceMap = map;
        }

        return bundled;
    }

    /**
     * Анализировать зависимости
     */
    async analyzeDependencies(entryPath) {
        const modules = new Map();

        const analyze = async (filePath, parentPath = null) => {
            if (modules.has(filePath)) {
                return modules.get(filePath);
            }

            const source = readFileSync(filePath, 'utf-8');
            const module = {
                path: filePath,
                source,
                imports: [],
                exports: [],
                dependencies: new Set()
            };

            modules.set(filePath, module);

            // Найти import и export statements
            const importRegex = /(?:импорт|import)\s+([^;]+);/g;
            const exportRegex = /(?:экспорт|export)\s+(?:поумолчанию|default)?\s+([^;]+);/g;

            let match;
            while ((match = importRegex.exec(source)) !== null) {
                const importSpec = match[1].trim();
                const depPath = this.extractImportPath(importSpec);

                if (depPath) {
                    const resolvedPath = await this.resolvePath(depPath, filePath);
                    module.imports.push({
                        spec: importSpec,
                        path: depPath,
                        resolvedPath
                    });
                    module.dependencies.add(resolvedPath);

                    // Рекурсивно анализируем зависимости
                    if (!modules.has(resolvedPath)) {
                        await analyze(resolvedPath, filePath);
                    }
                }
            }

            while ((match = exportRegex.exec(source)) !== null) {
                module.exports.push(match[1].trim());
            }

            return module;
        };

        await analyze(entryPath);
        return modules;
    }

    /**
     * Извлечь путь из import statement
     */
    extractImportPath(importSpec) {
        const fromMatch = importSpec.match(/(?:из|from)\s+['"]([^'"]+)['"]/);
        return fromMatch ? fromMatch[1] : null;
    }

    /**
     * Разрешить путь модуля
     */
    async resolvePath(importPath, currentPath) {
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const resolved = join(dirname(currentPath), importPath);

            // Проверяем расширения
            const extensions = ['.vx', '.js'];
            for (const ext of extensions) {
                if (existsSync(resolved + ext)) {
                    return resolved + ext;
                }
            }

            // Проверяем index.vx
            const indexFile = join(resolved, 'index.vx');
            if (existsSync(indexFile)) {
                return indexFile;
            }

            return resolved;
        }

        // Для пакетов из node_modules
        const nodeModulesPath = join(dirname(currentPath), 'node_modules', importPath);
        if (existsSync(nodeModulesPath + '.vx')) {
            return nodeModulesPath + '.vx';
        }

        throw new Error(`Не удалось разрешить модуль: ${importPath}`);
    }

    /**
     * Топологическая сортировка зависимостей
     */
    topologicalSort(modules) {
        const visited = new Set();
        const result = [];
        const visiting = new Set();

        const visit = (module) => {
            if (visiting.has(module.path)) {
                throw new Error(`Циклическая зависимость: ${module.path}`);
            }

            if (visited.has(module.path)) {
                return;
            }

            visiting.add(module.path);
            visited.add(module.path);

            for (const dep of module.dependencies) {
                const depModule = modules.get(dep);
                if (depModule) {
                    visit(depModule);
                }
            }

            visiting.delete(module.path);
            result.push(module);
        };

        for (const module of modules.values()) {
            if (!visited.has(module.path)) {
                visit(module);
            }
        }

        return result.reverse();
    }

    /**
     * Сгенерировать бандл
     */
    generateBundle(modules) {
        let output = '';
        const outputDir = dirname(this.output);

        switch (this.format) {
            case 'esm':
                output = this.generateESM(modules, outputDir);
                break;
            case 'cjs':
                output = this.generateCJS(modules, outputDir);
                break;
            case 'iife':
                output = this.generateIIFE(modules, outputDir);
                break;
            case 'umd':
                output = this.generateUMD(modules, outputDir);
                break;
            default:
                throw new Error(`Неподдерживаемый формат: ${this.format}`);
        }

        if (this.minify) {
            output = this.minify(output);
        }

        return {
            code: output,
            modules: modules.size,
            format: this.format
        };
    }

    /**
     * Сгенерировать ESM формат
     */
    generateESM(modules, outputDir) {
        let output = '';

        // Все модули в одном файле с комментариями
        output += '// VladX Bundle\n';
        output += '// Generated by VladX Bundler\n\n';

        for (const module of modules) {
            const relativePath = relative(outputDir, module.path);
            output += `// Module: ${relativePath}\n`;
            output += this.rewriteImports(module, modules, outputDir);
            output += '\n';
        }

        return output;
    }

    /**
     * Сгенерировать CJS формат
     */
    generateCJS(modules, outputDir) {
        let output = '';
        const moduleMap = new Map();
        let index = 0;

        // Создаем map модулей
        for (const module of modules) {
            const id = `module_${index++}`;
            moduleMap.set(module.path, id);
        }

        // IIFE обертка
        output += '(function() {\n';
        output += '  const modules = {};\n\n';

        // Определяем модули
        for (const module of modules) {
            const id = moduleMap.get(module.path);
            const rewritten = this.rewriteImportsCJS(module, moduleMap, outputDir);
            output += `  ${id} = function(module, exports) {\n`;
            output += `    ${rewritten}\n`;
            output += `  };\n\n`;
        }

        // Инициализируем модули
        for (const module of modules) {
            const id = moduleMap.get(module.path);
            output += `  ${id}(${id}, ${id}.exports = {});\n`;
        }

        output += '})();\n';

        return output;
    }

    /**
     * Сгенерировать IIFE формат
     */
    generateIIFE(modules, outputDir) {
        let output = '';

        output += '(function() {\n';
        output += '  "use strict";\n\n';

        for (const module of modules) {
            const rewritten = this.rewriteImports(module, modules, outputDir);
            output += `  ${rewrapped}\n\n`;
        }

        output += '})();\n';

        return output;
    }

    /**
     * Сгенерировать UMD формат
     */
    generateUMD(modules, outputDir) {
        let output = '';

        output += '(function(root, factory) {\n';
        output += '  if (typeof define === "function" && define.amd) {\n';
        output += '    define([], factory);\n';
        output += '  } else if (typeof module === "object" && module.exports) {\n';
        output += '    module.exports = factory();\n';
        output += '  } else {\n';
        output += '    root.VladX = factory();\n';
        output += '  }\n';
        output += '})(this, function() {\n\n';

        output += this.generateCJS(modules, outputDir);

        output += '\n});\n';

        return output;
    }

    /**
     * Переписать импорты для ESM
     */
    rewriteImports(module, modules, outputDir) {
        let source = module.source;

        for (const imp of module.imports) {
            if (modules.has(imp.resolvedPath)) {
                // Internal module - replace path
                const relativePath = relative(outputDir, imp.resolvedPath);
                source = source.replace(imp.spec, imp.spec.replace(imp.path, relativePath));
            }
        }

        return source;
    }

    /**
     * Переписать импорты для CJS
     */
    rewriteImportsCJS(module, moduleMap, outputDir) {
        let source = module.source;

        for (const imp of module.imports) {
            if (moduleMap.has(imp.resolvedPath)) {
                const id = moduleMap.get(imp.resolvedPath);
                source = source.replace(imp.spec, id);
            }
        }

        return source;
    }

    /**
     * Минификация
     */
    minify(code) {
        let minified = code;

        // Удаляем комментарии
        minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');
        minified = minified.replace(/\/\/.*$/gm, '');

        // Удаляем лишние пробелы и переводы строк
        minified = minified.replace(/\s+/g, ' ');
        minified = minified.trim();

        // Удаляем пробелы вокруг операторов
        minified = minified.replace(/\s*([{};:,=+*/%&|^~!?<>])\s*/g, '$1');

        return minified;
    }

    /**
     * Сгенерировать source map
     */
    generateSourceMap(modules) {
        const mappings = [];

        let generatedLine = 1;
        let generatedColumn = 0;

        for (const module of modules) {
            const lines = module.source.split('\n');

            for (let i = 0; i < lines.length; i++) {
                mappings.push({
                    generated: {
                        line: generatedLine,
                        column: generatedColumn
                    },
                    original: {
                        line: i + 1,
                        column: 0
                    },
                    source: module.path,
                    name: null
                });

                generatedLine++;
                generatedColumn = 0;
            }
        }

        return {
            version: 3,
            mappings,
            sources: Array.from(modules.values()).map(m => m.path),
            names: []
        };
    }

    /**
     * Записать бандл в файл
     */
    async write(bundled) {
        writeFileSync(this.output, bundled.code, 'utf-8');

        if (this.sourceMap && bundled.sourceMap) {
            const mapPath = this.output + '.map';
            writeFileSync(mapPath, JSON.stringify(bundled.sourceMap, null, 2), 'utf-8');
        }

        return this.output;
    }
}

export default Bundle;
