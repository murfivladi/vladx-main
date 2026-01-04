/**
 * JIT Compiler for VladX — Компиляция в JavaScript для повышения производительности
 * Преобразует часто выполняемые функции VladX в оптимизированный JavaScript код
 */

import { VladXObject } from '../runtime/vladx-object.js';

export class JITCompiler {
    constructor(interpreter) {
        this.interpreter = interpreter;
        this.compiledFunctions = new Map(); // Кэш скомпилированных функций
        this.functionCallCounts = new Map(); // Счетчик вызовов функций
        this.hotReloadEnabled = true;
        this.compilationThreshold = 10; // После скольки вызовов компилировать
    }

    /**
     * Проверка, нужно ли компилировать функцию
     */
    shouldCompile(functionName) {
        const count = this.functionCallCounts.get(functionName) || 0;
        return count >= this.compilationThreshold && !this.compiledFunctions.has(functionName);
    }

    /**
     * Увеличение счетчика вызовов функции
     */
    incrementCallCount(functionName) {
        const count = this.functionCallCounts.get(functionName) || 0;
        this.functionCallCounts.set(functionName, count + 1);
    }

    /**
     * Проверка, нужно ли компилировать функцию
     */
    shouldCompile(functionName) {
        const count = this.functionCallCounts.get(functionName) || 0;
        return count >= this.compilationThreshold && !this.compiledFunctions.has(functionName);
    }

    /**
     * Увеличение счетчика вызовов функции
     */
    incrementCallCount(functionName) {
        const count = this.functionCallCounts.get(functionName) || 0;
        this.functionCallCounts.set(functionName, count + 1);
    }

    /**
     * Компиляция функции VladX в JavaScript
     */
    compileFunction(funcNode, functionName = null) {
        try {
            const compiledCode = this.generateFunctionCode(funcNode, functionName);

            // Создаем функцию из сгенерированного кода
            const compiledFunction = new Function('__builtins__', '__env__', '__interpreter__', compiledCode);

            this.compiledFunctions.set(functionName || funcNode.name, {
                compiledFunction,
                originalNode: funcNode,
                compiledAt: Date.now()
            });

            return compiledFunction;
        } catch (error) {
            console.warn(`JIT compilation failed for ${functionName}:`, error);
            return null;
        }
    }

    /**
     * Генерация JavaScript кода из AST функции
     */
    generateFunctionCode(funcNode, functionName) {
        const params = (funcNode.params || funcNode.parameters || []).map(p => p.name || p);
        const paramNames = params.join(', ');

        // Генерируем тело функции (body может быть BlockStatement)
        const statements = funcNode.body && funcNode.body.body ? funcNode.body.body : (funcNode.body || []);
        const bodyCode = this.generateBodyCode(statements);

        // Оборачиваем в try-catch для обработки ошибок
        const wrappedCode = `
            try {
                ${bodyCode}
            } catch (error) {
                __interpreter.wrapError(error);
                throw error;
            }
        `;

        // Возвращаем код анонимной функции
        return `return async function(${paramNames}) { ${wrappedCode} };`;
    }

    /**
     * Генерация кода для тела функции
     */
    generateBodyCode(statements) {
        const lines = [];

        for (const stmt of statements) {
            const line = this.generateStatementCode(stmt);
            if (line) {
                lines.push(line);
            }
        }

        return lines.join('\n');
    }

    /**
     * Генерация кода для отдельного statement
     */
    generateStatementCode(stmt) {
        switch (stmt.type) {
            case 'ReturnStatement':
                const returnValue = stmt.argument ? this.generateExpressionCode(stmt.argument) : 'null';
                return `return ${returnValue};`;

            case 'ExpressionStatement':
                return this.generateExpressionCode(stmt.expression) + ';';

            case 'LetStatement':
                const init = stmt.initializer ? this.generateExpressionCode(stmt.initializer) : 'undefined';
                return `let ${stmt.name} = ${init};`;

            case 'ConstStatement':
                const constInit = stmt.initializer ? this.generateExpressionCode(stmt.initializer) : 'undefined';
                return `const ${stmt.name} = ${constInit};`;

            case 'IfStatement':
                return this.generateIfCode(stmt);

            case 'WhileStatement':
                return this.generateWhileCode(stmt);

            case 'ForStatement':
                return this.generateForCode(stmt);

            default:
                // Для неподдерживаемых statements используем интерпретатор
                return `__interpreter.evaluateStatement(${JSON.stringify(stmt)});`;
        }
    }

    /**
     * Генерация кода для выражений
     */
    generateExpressionCode(expr) {
        switch (expr.type) {
            case 'Literal':
                return JSON.stringify(expr.value);

            case 'Identifier':
                return expr.name;

            case 'BinaryExpression':
                const left = this.generateExpressionCode(expr.left);
                const right = this.generateExpressionCode(expr.right);
                return `(${left} ${expr.operator} ${right})`;

            case 'UnaryExpression':
                const operand = this.generateExpressionCode(expr.operand);
                return `${expr.operator}${operand}`;

            case 'CallExpression':
                const callee = this.generateExpressionCode(expr.callee);
                const args = expr.arguments.map(arg => this.generateExpressionCode(arg)).join(', ');
                return `await ${callee}(${args})`;

            case 'MemberExpression':
                const obj = this.generateExpressionCode(expr.object);
                const prop = this.generateExpressionCode(expr.property);
                return `${obj}.${prop}`;

            case 'FunctionExpression':
                // Встраиваем определение функции
                const funcParams = expr.parameters.map(p => p.name).join(', ');
                const funcBody = this.generateBodyCode(expr.body);
                return `async function(${funcParams}) { ${funcBody} }`;

            default:
                // Для сложных выражений используем интерпретатор
                return `__interpreter.evaluateExpression(${JSON.stringify(expr)})`;
        }
    }

    /**
     * Генерация кода для if statement
     */
    generateIfCode(stmt) {
        const condition = this.generateExpressionCode(stmt.condition);
        const thenBranch = this.generateBodyCode(stmt.thenBranch);
        let code = `if (${condition}) { ${thenBranch} }`;

        if (stmt.elseBranch) {
            const elseBranch = this.generateBodyCode(stmt.elseBranch);
            code += ` else { ${elseBranch} }`;
        }

        return code;
    }

    /**
     * Генерация кода для while statement
     */
    generateWhileCode(stmt) {
        const condition = this.generateExpressionCode(stmt.condition);
        const body = this.generateBodyCode(stmt.body);
        return `while (${condition}) { ${body} }`;
    }

    /**
     * Генерация кода для for statement
     */
    generateForCode(stmt) {
        const init = this.generateStatementCode(stmt.initializer);
        const condition = this.generateExpressionCode(stmt.condition);
        const update = this.generateExpressionCode(stmt.update);
        const body = this.generateBodyCode(stmt.body);
        return `for (${init}; ${condition}; ${update}) { ${body} }`;
    }

    /**
     * Выполнение скомпилированной функции
     */
    async executeCompiledFunction(functionName, args, context) {
        const compiled = this.compiledFunctions.get(functionName);
        if (!compiled) {
            throw new Error(`Compiled function ${functionName} not found`);
        }

        try {
            // Создаем execution context
            const execFunction = compiled.compiledFunction(
                this.interpreter.builtins,
                context.environment || this.interpreter.currentEnv,
                this.interpreter
            );

            return await execFunction(...args);
        } catch (error) {
            console.warn(`Compiled function ${functionName} failed, falling back to interpreter:`, error);
            // Fallback to interpreter
            return this.interpreter.evaluateExpression(compiled.originalNode);
        }
    }

    /**
     * Очистка кэша скомпилированных функций
     */
    clearCache() {
        this.compiledFunctions.clear();
        this.functionCallCounts.clear();
    }

    /**
     * Горячая перезагрузка — очистка устаревших компиляций
     */
    hotReload() {
        if (!this.hotReloadEnabled) return;

        const now = Date.now();
        const staleThreshold = 5 * 60 * 1000; // 5 минут

        for (const [name, data] of this.compiledFunctions) {
            if (now - data.compiledAt > staleThreshold) {
                this.compiledFunctions.delete(name);
            }
        }
    }

    /**
     * Получение статистики JIT компиляции
     */
    getStats() {
        return {
            compiledFunctionsCount: this.compiledFunctions.size,
            functionCallCounts: Object.fromEntries(this.functionCallCounts),
            compilationThreshold: this.compilationThreshold
        };
    }
}