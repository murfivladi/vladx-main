/**
 * EnhancedModuleSystem — Улучшенная система модулей
 */

import { ModuleSystem } from './module-system.js';

export class EnhancedModuleSystem extends ModuleSystem {
    constructor(interpreter) {
        super(interpreter);
        this.circularDependencies = new Map();
        this.dependencyGraph = new Map();
        this.importStack = [];
        this.dynamicImports = new Map();
    }

    /**
     * Проверка на циклические зависимости
     */
    checkCircularDependencies(modulePath) {
        if (this.importStack.includes(modulePath)) {
            const cycle = [...this.importStack, modulePath];
            throw new Error(`Циклическая зависимость: ${cycle.join(' -> ')}`);
        }

        this.importStack.push(modulePath);

        const dependencies = this.dependencyGraph.get(modulePath) || [];

        for (const dep of dependencies) {
            this.checkCircularDependencies(dep);
        }

        this.importStack.pop();
    }

    /**
     * Добавить зависимость в граф
     */
    addDependency(from, to) {
        if (!this.dependencyGraph.has(from)) {
            this.dependencyGraph.set(from, []);
        }
        this.dependencyGraph.get(from).push(to);
    }

    /**
     * Динамический импорт
     */
    async dynamicImport(modulePath, currentPath) {
        const cacheKey = `${currentPath}:${modulePath}`;

        if (this.dynamicImports.has(cacheKey)) {
            return this.dynamicImports.get(cacheKey);
        }

        const promise = this.loadModule(modulePath, currentPath);
        this.dynamicImports.set(cacheKey, promise);

        try {
            return await promise;
        } catch (error) {
            this.dynamicImports.delete(cacheKey);
            throw error;
        }
    }

    /**
     * Переэкспорт
     */
    async reExport(fromModule, exports, currentPath) {
        const module = await this.loadModule(fromModule, currentPath);

        if (Array.isArray(exports)) {
            // Именованный реэкспорт
            const result = {};
            for (const name of exports) {
                if (name in module) {
                    result[name] = module[name];
                }
            }
            return result;
        } else if (typeof exports === 'string') {
            // Реэкспорт по умолчанию
            return module[exports] || module;
        } else {
            // Реэкспорт всего
            return module;
        }
    }

    /**
     * Conditional экспорт
     */
    async conditionalExport(modulePath, conditions, currentPath) {
        const module = await this.loadModule(modulePath, currentPath);

        for (const [condition, value] of Object.entries(conditions)) {
            if (this.checkCondition(condition)) {
                return value;
            }
        }

        return module;
    }

    /**
     * Проверка условия экспорта
     */
    checkCondition(condition) {
        switch (condition) {
            case 'production':
                return process.env.NODE_ENV === 'production';
            case 'development':
                return process.env.NODE_ENV === 'development';
            case 'test':
                return process.env.NODE_ENV === 'test';
            case 'node':
                return typeof process !== 'undefined';
            case 'browser':
                return typeof window !== 'undefined';
            default:
                return false;
        }
    }

    /**
     * Получить граф зависимостей
     */
    getDependencyGraph() {
        return {
            graph: Object.fromEntries(this.dependencyGraph),
            circular: Array.from(this.circularDependencies.entries())
        };
    }

    /**
     * Очистить граф зависимостей
     */
    clearDependencyGraph() {
        this.dependencyGraph.clear();
        this.circularDependencies.clear();
        this.importStack = [];
    }

    /**
     * Топологическая сортировка зависимостей
     */
    topologicalSort() {
        const visited = new Set();
        const result = [];
        const graph = Object.fromEntries(this.dependencyGraph);

        const visit = (node) => {
            if (visited.has(node)) return;
            visited.add(node);

            const dependencies = graph[node] || [];
            for (const dep of dependencies) {
                visit(dep);
            }

            result.push(node);
        };

        for (const node of Object.keys(graph)) {
            visit(node);
        }

        return result;
    }

    /**
     * Проверить модуль на наличие зависимостей
     */
    hasDependencies(modulePath) {
        const deps = this.dependencyGraph.get(modulePath);
        return deps && deps.length > 0;
    }

    /**
     * Получить все модули, которые зависят от данного
     */
    getDependents(modulePath) {
        const dependents = [];

        for (const [from, tos] of this.dependencyGraph.entries()) {
            if (tos.includes(modulePath)) {
                dependents.push(from);
            }
        }

        return dependents;
    }
}

export default EnhancedModuleSystem;
