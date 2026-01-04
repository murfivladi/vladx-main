/**
 * VladX Interpreter — Интерпретатор
 * Выполняет AST и управляет выполнением программы
 */

import { VladXObject, types } from '../runtime/vladx-object.js';
import { Environment } from '../runtime/environment.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Interpreter {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.maxExecutionTime = options.maxExecutionTime || 9999999999999999;
        this.startTime = null;
        
        // Глобальное окружение
        this.globalEnv = new Environment(null, '<global>');
        this.currentEnv = this.globalEnv;
        this.callStack = [];
        
        // Текущий контекст выполнения
        this.currentFilename = '<anonymous>';
        this.currentFunction = null;
        this.isReturn = false;
        this.returnValue = null;
        this.currentInstance = null;
        
        // Обработка ошибок
        this.errorHandler = null;
        this.handledErrors = new Set();
        
        // Встроенные функции
        this.builtins = new Map();
        
        // Флаг регистрации встроенных функций
        this.builtinsRegistered = false;
        
        // Таймер для защиты от бесконечных циклов
        this.executionTimer = null;
        
        // Система модулей
        this.moduleSystem = options.moduleSystem || null;
    }

    /**
     * Начало выполнения с таймером
     */
    startExecution() {
        this.startTime = Date.now();

        if (this.maxExecutionTime > 0 && !this.executionTimer) {
            this.executionTimer = setTimeout(() => {
                throw new Error(`Превышено максимальное время выполнения (${this.maxExecutionTime}мс)`);
            }, this.maxExecutionTime);
        }
    }

    /**
     * Остановка таймера
     */
    stopExecution() {
        if (this.executionTimer) {
            clearTimeout(this.executionTimer);
            this.executionTimer = null;
        }
    }

    /**
     * Интерпретация AST
     */
    async interpret(ast, options = {}) {
        if (this.debug) {
            console.log('[Interpreter] Starting interpretation');
        }
        this.startExecution();
        
        try {
            const previousEnv = this.currentEnv;
            const previousFilename = this.currentFilename;

            let executionEnv = this.currentEnv;
            if (options.environment) {
                executionEnv = options.environment;
            }
            this.currentFilename = options.filename || '<anonymous>';

            // Register builtins in the execution environment
            this.currentEnv = executionEnv;
            this.registerBuiltins();
            if (this.debug) {
                console.log('[Interpreter] Builtins registered');
            }

            // Create a child environment for program execution to allow local variables
            // to shadow built-in functions/constants
            const programEnv = executionEnv.child('<program>');
            this.currentEnv = programEnv;

            if (this.debug) {
                console.log('[Interpreter] AST body length:', ast.body.length);
            }
            const result = await this.evaluateProgram(ast);
            if (this.debug) {
                console.log('[Interpreter] Program evaluated');
            }
            this.stopExecution();

            // Merge exports from child environment to parent environment if they exist
            if (programEnv.exports && Object.keys(programEnv.exports).length > 0) {
                if (!executionEnv.exports) {
                    executionEnv.exports = {};
                }
                Object.assign(executionEnv.exports, programEnv.exports);
            }

            this.currentEnv = previousEnv; // Restore the original environment
            this.currentFilename = previousFilename;

            return result;

                    } catch (error) {
            this.stopExecution();
            if (this.debug) {
                console.error('[Interpreter] ПОЙМАНА ОШИБКА ВЫПОЛНЕНИЯ:', error);
                console.error('[Interpreter] Тип ошибки:', error.constructor.name);
                console.error('[Interpreter] Стек ошибки:');
                console.error(error.stack);
                console.error('[Interpreter] Текущий файл:', this.currentFilename);
                console.error('[Interpreter] Текущий стек вызовов:', this.callStack);
            }
            throw this.wrapError(error);
        }
    }

    /**
     * Регистрация встроенных функций в окружении
     */
    registerBuiltins() {
        if (this.builtinsRegistered) {
            return; // Уже зарегистрировано
        }
        
        for (const [name, fn] of this.builtins) {
            this.globalEnv.define(name, VladXObject.function(fn, name), true);
        }
        
        this.builtinsRegistered = true;
    }

    /**
     * Выполнение программы
     */
    async evaluateProgram(program) {
        let result = VladXObject.null();
        
        for (const statement of program.body) {
            if (statement.type === 'EmptyStatement') continue;
            
            try {
                result = await this.evaluateStatement(statement);
                
                if (this.isReturn) {
                    break;
                }
            } catch (error) {
                if (this.errorHandler) {
                    await this.executeCatch(this.errorHandler, error);
                    this.errorHandler = null;
                } else {
                    throw error;
                }
            }
        }
        
        return result;
    }

    /**
     * Выполнение инструкции
     */
    async evaluateStatement(statement) {
        if (!statement) {
            return VladXObject.null();
        }
        
        switch (statement.type) {
            case 'ExpressionStatement':
                return await this.evaluateExpression(statement.expression);

            case 'LetStatement':
                return await this.evaluateLetStatement(statement);

            case 'ConstStatement':
                return await this.evaluateConstStatement(statement);

            case 'VariableDeclarationWithPattern':
                return await this.evaluateVariableDeclarationWithPattern(statement);

            case 'ReturnStatement':
                return await this.evaluateReturnStatement(statement);

            case 'BlockStatement':
                return await this.evaluateBlockStatement(statement);

            case 'IfStatement':
                return await this.evaluateIfStatement(statement);

            case 'WhileStatement':
                return await this.evaluateWhileStatement(statement);

            case 'ForStatement':
                return await this.evaluateForStatement(statement);

            case 'BreakStatement':
                return this.evaluateBreakStatement(statement);

            case 'ContinueStatement':
                return this.evaluateContinueStatement(statement);

            case 'FunctionDeclaration':
                return await this.evaluateFunctionDeclaration(statement);

            case 'ClassDeclaration':
                return await this.evaluateClassDeclaration(statement);

            case 'TryStatement':
                return await this.evaluateTryStatement(statement);

            case 'ThrowStatement':
                return await this.evaluateThrowStatement(statement);

            case 'SwitchStatement':
                return await this.evaluateSwitchStatement(statement);

            case 'ImportStatement':
                return await this.evaluateImportStatement(statement);

            case 'ExportStatement':
                return await this.evaluateExportStatement(statement);

            case 'LabeledStatement':
                return await this.evaluateLabeledStatement(statement);

            case 'EmptyStatement':
                return VladXObject.null();

            default:
                throw new Error(`Неизвестный тип инструкции: '${statement.type}'. Доступные типы: ExpressionStatement, LetStatement, ConstStatement, ReturnStatement, BlockStatement, IfStatement, WhileStatement, ForStatement, BreakStatement, ContinueStatement, FunctionDeclaration, ClassDeclaration, TryStatement, ThrowStatement, SwitchStatement, ImportStatement, ExportStatement, LabeledStatement, EmptyStatement`);
        }
    }

    // ========== Выражения ==========

    /**
     * Вычисление выражения
     */
    async evaluateExpression(expr) {
        if (!expr) {
            return VladXObject.null();
        }
        
        switch (expr.type) {
            case 'Literal':
                return this.evaluateLiteral(expr);

            case 'Identifier':
                return this.evaluateIdentifier(expr);

            case 'ThisExpression':
                return this.evaluateThisExpression(expr);

            case 'SuperExpression':
                return this.evaluateSuperExpression(expr);

            case 'NewExpression':
                return this.evaluateNewExpression(expr);

            case 'BinaryExpression':
                return this.evaluateBinaryExpression(expr);

            case 'UnaryExpression':
                return this.evaluateUnaryExpression(expr);

            case 'CallExpression':
                return this.evaluateCallExpression(expr);

            case 'MemberExpression':
                return this.evaluateMemberExpression(expr);

            case 'Assignment':
                return this.evaluateAssignment(expr);

            case 'MemberAssignment':
                return this.evaluateMemberAssignment(expr);

            case 'AssignmentExpression':
                return this.evaluateAssignmentExpression(expr);

            case 'CompoundAssignmentExpression':
                return this.evaluateCompoundAssignmentExpression(expr);

            case 'BitwiseExpression':
                return this.evaluateBitwiseExpression(expr);

            case 'TemplateLiteral':
                return this.evaluateTemplateLiteral(expr);

            case 'AwaitExpression':
                return this.evaluateAwaitExpression(expr);

            case 'ArrayExpression':
                return this.evaluateArrayExpression(expr);

            case 'ObjectExpression':
                return this.evaluateObjectExpression(expr);

            case 'FunctionDeclaration':
                return this.evaluateFunctionDeclaration(expr);

            case 'ArrowFunctionExpression':
                return this.evaluateArrowFunctionExpression(expr);

            case 'TernaryExpression':
                return this.evaluateTernaryExpression(expr);

            case 'ImportExpression':
                return this.evaluateImportExpression(expr);

            case 'SequenceExpression':
                return this.evaluateSequenceExpression(expr);

            case 'ArrayPattern':
                return this.evaluateArrayPattern(expr);

            case 'ObjectPattern':
                return this.evaluateObjectPattern(expr);

            default:
                throw new Error(`Неизвестный тип выражения: '${expr.type}'. Доступные типы: Literal, Identifier, ThisExpression, SuperExpression, BinaryExpression, UnaryExpression, CallExpression, MemberExpression, Assignment, MemberAssignment, AssignmentExpression, CompoundAssignmentExpression, BitwiseExpression, TemplateLiteral, ArrayExpression, ObjectExpression, FunctionDeclaration, ArrowFunctionExpression, TernaryExpression, ImportExpression, SequenceExpression, ArrayPattern, ObjectPattern, NewExpression`);
        }
    }

    /**
     * Литерал
     */
    evaluateLiteral(expr) {
        const value = expr.value;
        const valueType = typeof value;
        
        if (valueType === 'number') {
            return VladXObject.number(value);
        }
        if (valueType === 'boolean') {
            return VladXObject.boolean(value);
        }
        if (valueType === 'string') {
            return VladXObject.string(value);
        }
        if (value === null) {
            return VladXObject.null();
        }
        
        return VladXObject.string(value);
    }

    /**
     * Идентификатор
     */
    evaluateIdentifier(expr) {
        return this.currentEnv.get(expr.name);
    }

    /**
     * This выражение
     */
    evaluateThisExpression(expr) {
        if (this.currentInstance && this.currentInstance.type === 'instance') {
            return this.currentInstance;
        }
        throw new Error('Использование "это" (this) вне контекста метода класса');
    }

    /**
     * Super выражение
     */
    evaluateSuperExpression(expr) {
        if (!this.currentInstance || this.currentInstance.type !== 'instance') {
            throw new Error('Использование "super" вне контекста метода класса');
        }
        if (!this.currentInstance.prototype || !this.currentInstance.prototype.prototype) {
            throw new Error('У класса нет родительского класса');
        }

        const superClass = this.currentInstance.prototype.prototype;
        const superInstance = VladXObject.instance(superClass);
        superInstance.value = this.currentInstance.value;
        return superInstance;
    }

    /**
     * New expression - создание экземпляра класса
     */
    async evaluateNewExpression(expr) {
        const callee = await this.evaluateExpression(expr.callee);

        if (!callee || callee.type !== 'class') {
            if (callee) {
                throw new Error(`new можно использовать только с классами, получено: ${callee.type}`);
            } else {
                throw new Error('new можно использовать только с классами, callee is null');
            }
        }

        const instance = VladXObject.instance(callee);

        const args = [];
        for (const arg of expr.args) {
            args.push(await this.evaluateExpression(arg));
        }

        if (callee.methods && (callee.methods.has('конструктор') || callee.methods.has('constructor'))) {
            const constructorMethod = callee.methods.has('конструктор') ? callee.methods.get('конструктор') : callee.methods.get('constructor');

            const previousInstance = this.currentInstance;
            this.currentInstance = instance;
            try {
                await this.executeFunction(constructorMethod, args);
            } finally {
                this.currentInstance = previousInstance;
            }
        } else if (callee.prototype && callee.prototype.methods && (callee.prototype.methods.has('конструктор') || callee.prototype.methods.has('constructor'))) {
            const parentConstructorMethod = callee.prototype.methods.has('конструктор') ? callee.prototype.methods.get('конструктор') : callee.prototype.methods.get('constructor');

            const previousInstance = this.currentInstance;
            const superInstance = VladXObject.instance(callee.prototype);
            superInstance.value = instance.value;
            this.currentInstance = superInstance;
            try {
                await this.executeFunction(parentConstructorMethod, args);
            } finally {
                this.currentInstance = previousInstance;
            }
        }

        return instance;
    }

    /**
     * Бинарное выражение
     */
    async evaluateBinaryExpression(expr) {
        const left = await this.evaluateExpression(expr.left);
        const right = await this.evaluateExpression(expr.right);
        
        // Извлекаем "сырые" значения из VladXObject
        const lval = (left && typeof left === 'object' && 'value' in left) ? left.value : (left ?? '');
const rval = (right && typeof right === 'object' && 'value' in right) ? right.value : (right ?? '');
        
        switch (expr.operator) {
            case '+': 
                // Проверяем, если хотя бы один операнд строка
                if (typeof lval === 'string' || typeof rval === 'string') {
                    return VladXObject.string(String(lval) + String(rval));
                }
                return VladXObject.number(lval + rval);
            case '-': return VladXObject.number(lval - rval);
            case '*': return VladXObject.number(lval * rval);
            case '/':
                if (rval === 0) throw new Error(`Деление на ноль: ${lval} / ${rval}`);
                return VladXObject.number(lval / rval);
            case '%': return VladXObject.number(lval % rval);
            case '**': return VladXObject.number(Math.pow(lval, rval));

            case '==': return VladXObject.boolean(lval == rval);
            case '!=': return VladXObject.boolean(lval != rval);
            case '<': return VladXObject.boolean(lval < rval);
            case '>': return VladXObject.boolean(lval > rval);
            case '<=': return VladXObject.boolean(lval <= rval);
            case '>=': return VladXObject.boolean(lval >= rval);

            case '&&': return VladXObject.boolean(lval && rval);
            case '||': return VladXObject.boolean(lval || rval);

            default:
                throw new Error(`Неизвестный оператор: '${expr.operator}' при вычислении выражения ${lval} ${expr.operator} ${rval}`);
        }
    }

    /**
     * Унарное выражение
     */
    async evaluateUnaryExpression(expr) {
        const operand = await this.evaluateExpression(expr.operand);
        const val = operand && operand.value !== undefined ? operand.value : operand;
        
        switch (expr.operator) {
            case '-': return VladXObject.number(-val);
            case '+': return VladXObject.number(+val);
            case '!': return VladXObject.boolean(!val);

            default:
                throw new Error(`Неизвестный унарный оператор: '${expr.operator}' при вычислении выражения ${expr.operator} ${val}`);
        }
    }

    /**
     * Вызов функции
     */
    async evaluateCallExpression(expr) {
        let instance = null;

        if (expr.callee.type === 'MemberExpression') {
            const object = await this.evaluateExpression(expr.callee.object);
            if (object && object.type === 'instance') {
                instance = object;
            }
        }

        const callee = await this.evaluateExpression(expr.callee);

        const args = [];
        for (const arg of expr.args) {
            if (arg && arg.type === 'SpreadElement') {
                const spreadValue = await this.evaluateExpression(arg.argument);
                const spreadArray = spreadValue && spreadValue.value ? spreadValue.value : [];

                if (Array.isArray(spreadArray)) {
                    args.push(...spreadArray);
                } else {
                    args.push(spreadValue);
                }
            } else {
                args.push(await this.evaluateExpression(arg));
            }
        }

        const convertToNative = (val) => {
            if (val && typeof val === 'object' && val.type !== undefined) {
                if (val.type === 'function' || val.type === 'closure') {
                    return val;
                }

                if (val.type === 'null') {
                    return val;
                }

                if (val.value !== undefined) {
                    const rawValue = val.value;

                    if (Array.isArray(rawValue)) {
                        return rawValue.map(item => convertToNative(item));
                    } else if (rawValue && typeof rawValue === 'object' && rawValue.constructor === Object) {
                        const converted = {};
                        for (const key in rawValue) {
                            if (rawValue.hasOwnProperty(key)) {
                                converted[key] = convertToNative(rawValue[key]);
                            }
                        }
                        return converted;
                    } else {
                        return rawValue;
                    }
                }
            }
            return val;
        };

        const nativeArgs = args.map(arg => convertToNative(arg));

        if (callee && callee.isNative) {
            try {
                const result = callee.value(...nativeArgs);
                if (result instanceof Promise) {
                    return await result;
                }
                return result;
            } catch (error) {
                if (error && error.type === 'error') {
                    throw new Error(error.value || 'Неизвестная ошибка во встроенной функции');
                }
                throw error;
            }
        }

        if (callee && (callee.type === 'function' || callee.type === 'closure')) {
            const previousInstance = this.currentInstance;
            this.currentInstance = instance;
            try {
                const result = await this.executeFunction(callee, args);
                return result;
            } finally {
                this.currentInstance = previousInstance;
            }
        }

        let calleeInfo = 'неизвестное значение';
        if (callee) {
            if (callee.type === 'string') {
                calleeInfo = `строка "${callee.value}"`;
            } else if (callee.type === 'number') {
                calleeInfo = `число ${callee.value}`;
            } else if (callee.type === 'boolean') {
                calleeInfo = `логическое значение`;
            } else if (callee.type === 'null') {
                calleeInfo = `значение nothing`;
            } else if (Array.isArray(callee)) {
                calleeInfo = `массив`;
            } else if (typeof callee === 'object') {
                calleeInfo = `объект`;
            } else {
                calleeInfo = String(callee);
            }
        }

        const error = new Error(`Ошибка вызова функции: '${calleeInfo}' не является функцией и не может быть вызвано. Проверьте, что вы вызываете существующую функцию.`);
        console.log('[DEBUG] evaluateCallExpression error:', error);
        throw error;
    }

    /**
     * Выполнение функции
     */
    async executeFunction(fn, args) {
        const previousFunction = this.currentFunction;
        const previousReturn = { isReturn: this.isReturn, value: this.returnValue };
        const previousEnv = this.currentEnv;

        // Создаем локальное окружение для функции
        const functionEnv = fn.env ? fn.env.child(`<function ${fn.name}>`) : new Environment(this.currentEnv, `<function ${fn.name}>`);
        this.currentEnv = functionEnv;

        // Определяем параметры в локальном окружении
        if (fn.ast && fn.ast.params) {
            let restParamIndex = -1;

            // Найдем индекс rest параметра, если он есть
            for (let i = 0; i < fn.ast.params.length; i++) {
                if (fn.ast.params[i].type === 'RestElement') {
                    restParamIndex = i;
                    break;
                }
            }

            for (let i = 0; i < fn.ast.params.length; i++) {
                const param = fn.ast.params[i];
                const argValue = args[i];

                // Обработка rest параметра
                if (param.type === 'RestElement') {
                    // Собираем все оставшиеся аргументы в массив
                    const restArgs = args.slice(i) || [];
                    functionEnv.define(param.argument.name, VladXObject.array(restArgs));
                }
                // Проверяем, является ли параметр шаблоном присваивания (имеет значение по умолчанию)
                else if (param.type === 'AssignmentPattern') {
                    // Если аргумент не передан, используем значение по умолчанию
                    if (argValue === undefined) {
                        const defaultValue = await this.evaluateExpression(param.right);
                        functionEnv.define(param.left.name, defaultValue);
                    } else {
                        functionEnv.define(param.left.name, argValue);
                    }
                } else {
                    // Обычный параметр
                    functionEnv.define(param.name, argValue ? argValue : VladXObject.null());
                }
            }
        }

        this.currentFunction = fn;
        this.isReturn = false;
        this.returnValue = null;

        this.callStack.push(fn.name);

        let result = VladXObject.null();
        let didReturn = false;
        let returnVal = null;

        try {
            if (fn.ast && fn.ast.body) {
                // fn.ast.body is a BlockStatement, so we need fn.ast.body.body to get the statements
                const bodyStatements = fn.ast.body.body || [];
                let lastExpressionResult = null;

                for (const statement of bodyStatements) {
                    result = await this.evaluateStatement(statement);

                    // Сохраняем результат ExpressionStatement для возврата
                    if (statement.type === 'ExpressionStatement') {
                        lastExpressionResult = result;
                    }

                    if (this.isReturn) {
                        didReturn = true;
                        returnVal = this.returnValue;
                        break;
                    }
                }

                // Если не было return, возвращаем результат последнего ExpressionStatement
                if (!didReturn && lastExpressionResult !== null) {
                    result = lastExpressionResult;
                }
            }
        } finally {
            this.currentFunction = previousFunction;
            this.isReturn = previousReturn.isReturn;
            this.returnValue = previousReturn.value;
            this.currentEnv = previousEnv;

            this.callStack.pop();
        }

        // Если функция асинхронная, и результат - промис, дожидаемся его
        if (fn.ast && fn.ast.isAsync) {
            if (result && typeof result.then === 'function') {
                return await result;
            }
            if (result && result.value && typeof result.value.then === 'function') {
                const resolved = await result.value;
                return VladXObject.fromJS(resolved);
            }
        }

        return didReturn ? returnVal : result;
    }

    /**
     * Присваивание
     */
    async evaluateAssignment(expr) {
        const value = await this.evaluateExpression(expr.value);

        // Обработка обычного присваивания
        if (expr.name) {
            this.currentEnv.assign(expr.name, value);
        }
        return value;
    }

    /**
     * Деструктуризация массива
     */
    async evaluateArrayDestructuring(pattern, value) {
        // Извлекаем нативный массив из VladXObject
        let arrayValue;
        if (value && value.type === 'array' && value.value) {
            arrayValue = value.value;
        } else if (Array.isArray(value)) {
            arrayValue = value;
        } else {
            throw new Error('Деструктуризация массива требует массив в правой части');
        }

        for (let i = 0; i < pattern.elements.length; i++) {
            const element = pattern.elements[i];
            let elementValue = VladXObject.null();

            if (i < arrayValue.length) {
                const rawValue = arrayValue[i];
                // Преобразуем значение в VladXObject если нужно
                if (rawValue && rawValue.type !== undefined) {
                    elementValue = rawValue; // Уже VladXObject
                } else {
                    elementValue = VladXObject.fromJS(rawValue);
                }
            }

            if (element) {
                if (element.type === 'Identifier') {
                    this.currentEnv.define(element.name, elementValue);
                } else if (element.type === 'AssignmentPattern') {
                    // Обработка параметров с умолчанием
                    this.currentEnv.define(element.left.name, elementValue);
                }
            }
            // TODO: Поддержка вложенной деструктуризации
        }

        return value;
    }

    /**
     * Деструктуризация объекта
     */
    async evaluateObjectDestructuring(pattern, value) {
        // Извлекаем нативный объект из VladXObject
        let objectValue;
        if (value && value.type === 'object' && value.value) {
            objectValue = value.value;
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            objectValue = value;
        } else {
            throw new Error('Деструктуризация объекта требует объект в правой части');
        }

        for (const property of pattern.properties) {
            if (property.type === 'Property') {
                let propertyValue = VladXObject.null();

                if (property.computed) {
                    // Вычисленное свойство
                    const key = await this.evaluateExpression(property.key);
                    const keyValue = key && key.value !== undefined ? key.value : key;
                    const rawValue = objectValue[keyValue];
                    propertyValue = rawValue !== undefined ? VladXObject.fromJS(rawValue) : VladXObject.null();
                } else {
                    // Статическое свойство
                    let key;
                    if (property.key && property.key.name) {
                        key = property.key.name;
                    } else if (property.key && property.key.value !== undefined) {
                        key = property.key.value;
                    } else {
                        key = property.key;
                    }
                    const rawValue = objectValue[key];
                    propertyValue = rawValue !== undefined ? VladXObject.fromJS(rawValue) : VladXObject.null();
                }

                if (property.value && property.value.type === 'Identifier') {
                    this.currentEnv.define(property.value.name, propertyValue);
                } else if (property.value && property.value.type === 'AssignmentPattern') {
                    // Обработка параметров с умолчанием
                    this.currentEnv.define(property.value.left.name, propertyValue);
                }
            }
        }

        return value;
    }

    /**
     * Обычное присваивание выражения
     */
    async evaluateAssignmentExpression(expr) {
        const left = await this.evaluateExpression(expr.left);
        const right = await this.evaluateExpression(expr.right);

        // Обработка обычного присваивания
        if (expr.operator === '=') {
            if (expr.left.type === 'Identifier') {
                this.currentEnv.assign(expr.left.name, right);
                return right;
            } else if (expr.left.type === 'MemberExpression') {
                // Обработка присваивания свойству объекта
                const object = await this.evaluateExpression(expr.left.object);
                const property = expr.left.property.name;

                if (object && typeof object === 'object' && object.value) {
                    object.value[property] = right;
                }
                return right;
            }
        }

        return right;
    }

    /**
     * Составное присваивание
     */
    async evaluateCompoundAssignmentExpression(expr) {
        const left = await this.evaluateExpression(expr.left);
        const right = await this.evaluateExpression(expr.right);

        // Получаем текущее значение левой части
        let currentValue;
        if (expr.left.type === 'Identifier') {
            currentValue = this.currentEnv.get(expr.left.name);
        } else if (expr.left.type === 'MemberExpression') {
            const object = await this.evaluateExpression(expr.left.object);
            const property = expr.left.property.name;
            currentValue = object.value[property];
        }

        // Выполняем операцию в зависимости от оператора
        let result;
        const leftVal = currentValue && currentValue.value !== undefined ? currentValue.value : currentValue;
        const rightVal = right && right.value !== undefined ? right.value : right;

        switch (expr.operator) {
            case '+=':
                if (typeof leftVal === 'string' || typeof rightVal === 'string') {
                    result = VladXObject.string(String(leftVal) + String(rightVal));
                } else {
                    result = VladXObject.number(leftVal + rightVal);
                }
                break;
            case '-=':
                result = VladXObject.number(leftVal - rightVal);
                break;
            case '*=':
                result = VladXObject.number(leftVal * rightVal);
                break;
            case '/=':
                if (rightVal === 0) throw new Error(`Деление на ноль: ${leftVal} / ${rightVal}`);
                result = VladXObject.number(leftVal / rightVal);
                break;
            case '%=':
                result = VladXObject.number(leftVal % rightVal);
                break;
            default:
                throw new Error(`Неизвестный оператор составного присваивания: ${expr.operator}`);
        }

        // Присваиваем результат обратно
        if (expr.left.type === 'Identifier') {
            this.currentEnv.assign(expr.left.name, result);
        } else if (expr.left.type === 'MemberExpression') {
            const object = await this.evaluateExpression(expr.left.object);
            const property = expr.left.property.name;
            object.value[property] = result;
        }

        return result;
    }

    /**
     * Битовые выражения
     */
    async evaluateBitwiseExpression(expr) {
        const left = await this.evaluateExpression(expr.left);
        const right = await this.evaluateExpression(expr.right);

        const lval = left && left.value !== undefined ? left.value : left;
        const rval = right && right.value !== undefined ? right.value : right;

        switch (expr.operator) {
            case '<<':
                return VladXObject.number(lval << rval);
            case '>>':
                return VladXObject.number(lval >> rval);
            case '&':
                return VladXObject.number(lval & rval);
            case '|':
                return VladXObject.number(lval | rval);
            case '^':
                return VladXObject.number(lval ^ rval);
            default:
                throw new Error(`Неизвестный битовый оператор: ${expr.operator}`);
        }
    }

    /**
     * Шаблонная строка
     */
    async evaluateTemplateLiteral(expr) {
        // Временная реализация - возвращаем пустую строку
        return VladXObject.string('');
    }

    /**
     * Await выражение
     */
    async evaluateAwaitExpression(expr) {
        const value = await this.evaluateExpression(expr.argument);

        // Если значение является промисом, ожидаем его
        if (value && typeof value.then === 'function') {
            const awaitedValue = await value;
            return awaitedValue;
        }

        // Если это VladXObject с промисом внутри
        if (value && value.value && typeof value.value.then === 'function') {
            const awaitedValue = await value.value;
            return VladXObject.fromJS(awaitedValue);
        }

        // В противном случае возвращаем значение как есть
        return value;
    }

    async evaluateMemberAssignment(expr) {
        const object = await this.evaluateExpression(expr.object);
        const value = await this.evaluateExpression(expr.value);

        // Evaluate the property/index expression (for array access like arr[index])
        const property = await this.evaluateExpression(expr.property);
        const indexValue = property && property.value !== undefined ? property.value : property;

        // Handle array element assignment: array[index] = value
        if (object.type === 'array' && object.value && Array.isArray(object.value)) {
            const index = typeof indexValue === 'string' ? parseInt(indexValue, 10) : indexValue;

            if (typeof index === 'number' && index >= 0 && index < object.value.length) {
                object.value[index] = value;
            } else if (typeof index === 'number' && index === object.value.length) {
                object.value.push(value);
            } else {
                throw new Error(`Недопустимый индекс массива: ${index}, длина массива: ${object.value.length}`);
            }
        }
        else if (object.type === 'instance' && object.value && typeof object.value === 'object') {
            const propName = expr.property.name || String(indexValue);
            object.value[propName] = value;
        }
        else if (object.type === 'class' && !expr.computed) {
            const propName = expr.property.name;
            object[propName] = value;
        }
        else if (object.type === 'object' && object.value && typeof object.value === 'object') {
            const propName = expr.property.name || String(indexValue);
            object.value[propName] = value;
        }
        else if (object && typeof object === 'object' && !object.type) {
            const propName = expr.property.name || String(indexValue);
            object[propName] = value;
        }

        return value;
    }

    /**
     * Член объекта
     */
    async evaluateMemberExpression(expr) {
        const object = await this.evaluateExpression(expr.object);

        if (!object) {
            return VladXObject.null();
        }

        if (expr.computed) {
            // Вычисленный доступ: array[index] или obj[expression]
            const index = await this.evaluateExpression(expr.property);
            const indexValue = index && index.value !== undefined ? index.value : index;

            // Если это VladXObject массива
            if (object.type === 'array' && object.value && Array.isArray(object.value)) {
                return object.value[indexValue] !== undefined ? object.value[indexValue] : VladXObject.null();
            }
            // Если это VladXObject объекта
            else if (object.type === 'object' && object.value && typeof object.value === 'object') {
                const key = String(indexValue);
                return object.value[key] !== undefined ? object.value[key] : VladXObject.null();
            }
            // Если это обычный JS массив
            else if (Array.isArray(object)) {
                return object[indexValue] !== undefined ? object[indexValue] : VladXObject.null();
            }
            // Если это обычный JS объект
            else if (object && typeof object === 'object') {
                const key = String(indexValue);
                return object[key] !== undefined ? object[key] : VladXObject.null();
            }
        } else {
            const propName = expr.property.name;

            if (object.type === 'class' && object.staticMethods && object.staticMethods.has(propName)) {
                const staticMethod = object.staticMethods.get(propName);
                return staticMethod;
            }

            if (object.type === 'instance' && object.prototype && object.prototype.methods && object.prototype.methods.has(propName)) {
                const method = object.prototype.methods.get(propName);
                return method;
            }

            if (object.type === 'instance' && object.value && typeof object.value === 'object' && object.value[propName] !== undefined) {
                const val = object.value[propName];
                if (val && typeof val === 'object' && val.type !== undefined) {
                    return val;
                }
                return VladXObject.fromJS(val);
            }

            if (object.type !== undefined && object.value && object.value[propName] !== undefined) {
                const val = object.value[propName];
                if (val && typeof val === 'object' && val.type !== undefined) {
                    return val;
                }
                return VladXObject.fromJS(val);
            }

            if (object[propName] !== undefined) {
                const val = object[propName];
                if (val && typeof val === 'object' && val.type !== undefined) {
                    return val;
                }
                return VladXObject.fromJS(val);
            }
        }

        return VladXObject.null();
    }

    /**
     * Массив
     */
    async evaluateArrayExpression(expr) {
        const elements = [];

        if (expr.elements) {
            for (const el of expr.elements) {
                if (el && el.type === 'SpreadElement') {
                    const spreadValue = await this.evaluateExpression(el.argument);
                    const spreadArray = spreadValue && spreadValue.value ? spreadValue.value : [];

                    if (Array.isArray(spreadArray)) {
                        elements.push(...spreadArray);
                    } else {
                        // Если это не массив, просто добавляем значение
                        elements.push(spreadValue);
                    }
                } else {
                    elements.push(await this.evaluateExpression(el));
                }
            }
        }

        return VladXObject.array(elements);
    }

    /**
     * Паттерн массива (для деструктуризации, но может встречаться как выражение)
     */
    async evaluateArrayPattern(expr) {
        const elements = [];

        if (expr.elements) {
            for (const el of expr.elements) {
                if (el && el.type === 'SpreadElement') {
                    const spreadValue = await this.evaluateExpression(el.argument);
                    const spreadArray = spreadValue && spreadValue.value ? spreadValue.value : [];

                    if (Array.isArray(spreadArray)) {
                        elements.push(...spreadArray);
                    } else {
                        // Если это не массив, просто добавляем значение
                        elements.push(spreadValue);
                    }
                } else {
                    elements.push(await this.evaluateExpression(el));
                }
            }
        }

        return VladXObject.array(elements);
    }

    /**
     * Паттерн объекта (для деструктуризации, но может встречаться как выражение)
     */
    async evaluateObjectPattern(expr) {
        const obj = {};

        if (expr.properties) {
            for (const prop of expr.properties) {
                if (!prop) continue;

                let key = null;
                if (prop.key) {
                    key = prop.key.value || prop.key.name || String(prop.key);
                }

                const value = await this.evaluateExpression(prop.value);

                if (key !== null) {
                    obj[key] = value;
                }
            }
        }

        return VladXObject.object(obj);
    }

    /**
     * Объект
     */
    async evaluateObjectExpression(expr) {
        const obj = {};
        
        if (expr.properties) {
            for (const prop of expr.properties) {
                if (!prop) continue;
                
                let key = null;
                if (prop.key) {
                    key = prop.key.value || prop.key.name || String(prop.key);
                }
                
                const value = await this.evaluateExpression(prop.value);
                
                if (key !== null) {
                    obj[key] = value;
                }
            }
        }
        
        return VladXObject.object(obj);
    }

    /**
     * Объявление переменной
     */
    async evaluateLetStatement(stmt) {
        let value = VladXObject.null();

        if (stmt.initializer) {
            value = await this.evaluateExpression(stmt.initializer);
        }

        this.currentEnv.define(stmt.name, value);
        return value;
    }

    /**
     * Объявление переменной с паттерном (деструктуризация)
     */
    async evaluateVariableDeclarationWithPattern(stmt) {
        let value = VladXObject.null();

        if (stmt.initializer) {
            value = await this.evaluateExpression(stmt.initializer);
        }

        // Выполняем деструктуризацию в зависимости от типа паттерна
        if (stmt.pattern && stmt.pattern.type === 'ArrayPattern') {
            await this.evaluateArrayDestructuring(stmt.pattern, value);
        } else if (stmt.pattern && stmt.pattern.type === 'ObjectPattern') {
            await this.evaluateObjectDestructuring(stmt.pattern, value);
        } else {
            // This shouldn't happen if parser is correct, but just in case
            // If we get here, it means this was incorrectly processed as a pattern declaration
            throw new Error(`Неправильный тип паттерна: ${stmt.pattern ? stmt.pattern.type : 'undefined'}`);
        }

        return value;
    }

    /**
     * Объявление константы
     */
    async evaluateConstStatement(stmt) {
        if (!stmt.initializer) {
            throw new Error(`Константа '${stmt.name}' должна быть инициализирована значением. Константы не могут быть объявлены без начального значения.`);
        }
        
        const value = await this.evaluateExpression(stmt.initializer);
        this.currentEnv.define(stmt.name, value, true);
        return value;
    }

    /**
     * Return
     */
    async evaluateReturnStatement(stmt) {
        this.isReturn = true;
        this.returnValue = stmt.argument ? await this.evaluateExpression(stmt.argument) : VladXObject.null();
        return this.returnValue;
    }

    /**
     * Блок
     */
    async evaluateBlockStatement(stmt) {
        let result = VladXObject.null();
        
        if (stmt.body) {
            for (const statement of stmt.body) {
                result = await this.evaluateStatement(statement);
                
                if (this.isReturn) {
                    break;
                }
            }
        }
        
        return this.isReturn ? this.returnValue : result;
    }

    /**
     * If-else
     */
    async evaluateIfStatement(stmt) {
        const condition = await this.evaluateExpression(stmt.condition);
        const condValue = condition && condition.value !== undefined ? condition.value : condition;
        
        if (condValue) {
            return this.evaluateStatement(stmt.thenBranch);
        } else if (stmt.elseBranch) {
            return this.evaluateStatement(stmt.elseBranch);
        }
        
        return VladXObject.null();
    }

    /**
     * While
     */
    async evaluateWhileStatement(stmt) {
        let result = VladXObject.null();
        
        while (true) {
            const condition = await this.evaluateExpression(stmt.condition);
            const condValue = condition && condition.value !== undefined ? condition.value : condition;
            
            if (!condValue) break;
            
            try {
                result = await this.evaluateStatement(stmt.body);
            } catch (e) {
                if (e.message === 'break') {
                    break;
                }
                if (e.message === 'continue') {
                    continue;
                }
                throw e;
            }
        }
        
        return result;
    }

    /**
     * For
     */
    async evaluateForStatement(stmt) {
        let result = VladXObject.null();
        
        // Инициализация
        if (stmt.initializer && stmt.initializer.type !== 'EmptyStatement') {
            await this.evaluateStatement(stmt.initializer);
        }
        
        while (true) {
            // Проверка условия
            if (stmt.condition) {
                const condition = await this.evaluateExpression(stmt.condition);
                const condValue = condition && condition.value !== undefined ? condition.value : condition;
                if (!condValue) break;
            }
            
            try {
                result = await this.evaluateStatement(stmt.body);
            } catch (e) {
                if (e.message === 'break') {
                    break;
                }
                if (e.message === 'continue') {
                    // Продолжаем цикл
                } else {
                    throw e;
                }
            }
            
            // Обновление
            if (stmt.update && stmt.update.type !== 'EmptyStatement') {
                await this.evaluateExpression(stmt.update);
            }
        }
        
        return result;
    }

    /**
     * Break
     */
    evaluateBreakStatement(stmt) {
        throw new Error('break');
    }

    /**
     * Continue
     */
    evaluateContinueStatement(stmt) {
        throw new Error('continue');
    }

    /**
     * Объявление функции
     */
    evaluateFunctionDeclaration(stmt) {
        // Создаём легковесное замыкание без клонирования всего окружения
        // Это предотвращает утечки памяти через циклические ссылки
        const closure = VladXObject.closure({
            type: 'FunctionDeclaration',
            name: stmt.name,
            params: stmt.params,
            body: stmt.body,
            isAsync: stmt.isAsync
        }, this.currentEnv, stmt.name || '<anonymous>');

        this.currentEnv.define(stmt.name, closure);
        return VladXObject.null();
    }

    /**
     * Стрелочная функция
     */
    evaluateArrowFunctionExpression(expr) {
        // Используем текущее окружение без клонирования
        return VladXObject.closure({
            type: 'ArrowFunctionExpression',
            params: expr.params,
            body: Array.isArray(expr.body) ? expr.body : [{ type: 'ReturnStatement', argument: expr.body }],
            isAsync: expr.isAsync
        }, this.currentEnv, '<arrow>');
    }

    /**
     * Класс
     */
    async evaluateClassDeclaration(stmt) {
        const methods = new Map();
        const staticMethods = new Map();
        let superClass = null;

        if (stmt.superClass) {
            superClass = this.currentEnv.get(stmt.superClass);
            if (!superClass || superClass.type !== 'class') {
                throw new Error(`Родительский класс '${stmt.superClass}' не найден или не является классом`);
            }
        }

        if (stmt.methods) {
            for (const method of stmt.methods) {
                const methodClosure = VladXObject.closure({
                    type: 'FunctionDeclaration',
                    name: method.name,
                    params: method.params,
                    body: method.body,
                    isAsync: method.isAsync
                }, this.currentEnv, method.name);

                if (method.isStatic) {
                    staticMethods.set(method.name, methodClosure);
                } else {
                    methods.set(method.name, methodClosure);
                }
            }
        }

        const classObj = VladXObject.class(stmt.name, methods, staticMethods, superClass);
        this.currentEnv.define(stmt.name, classObj);
        return VladXObject.null();
    }

    /**
     * Try-catch-finally
     */
    async evaluateTryStatement(stmt) {
        let result = VladXObject.null();
        let error = null;
        
        // Try
        try {
            if (stmt.block && stmt.block.body) {
                for (const statement of stmt.block.body) {
                    result = await this.evaluateStatement(statement);
                    if (this.isReturn) break;
                }
            }
        } catch (e) {
            error = e;
        }
        
        // Catch
        if (stmt.handler && error) {
            const catchEnv = this.currentEnv.child('<catch>');
            if (stmt.handler.param) {
                catchEnv.define(stmt.handler.param, VladXObject.string(error.toString ? error.toString() : String(error)));
            }
            
            const previousEnv = this.currentEnv;
            this.currentEnv = catchEnv;
            
            if (stmt.handler.body && stmt.handler.body.body) {
                for (const statement of stmt.handler.body.body) {
                    result = await this.evaluateStatement(statement);
                    if (this.isReturn) break;
                }
            }
            
            this.currentEnv = previousEnv;
        }
        
        // Finally
        if (stmt.finalizer) {
            for (const statement of stmt.finalizer.body) {
                result = await this.evaluateStatement(statement);
                if (this.isReturn) break;
            }
        }
        
        return result;
    }

    /**
     * Throw
     */
    async evaluateThrowStatement(stmt) {
        const value = await this.evaluateExpression(stmt.argument);
        const val = value && value.value !== undefined ? value.value : value;
        throw new Error(String(val));
    }
    
    /**
     * Import - загрузка модуля
     */
    async evaluateImportStatement(stmt) {
        const modulePath = stmt.path;

        if (!this.moduleSystem) {
            throw new Error('Система модулей не инициализирована — moduleSystem is null!');
        }

        const moduleExports = await this.moduleSystem.loadModule(modulePath, this.currentFilename);

        let moduleName = stmt.alias;
        if (!moduleName) {
            const filename = modulePath.split('/').pop();
            const extIndex = filename.lastIndexOf('.');
            moduleName = extIndex > 0 ? filename.slice(0, extIndex) : filename;
            if (!moduleName) moduleName = 'module';
        }

        const moduleObj = VladXObject.object(moduleExports);
        this.currentEnv.define(moduleName, moduleObj);

        return VladXObject.null();
    }
    /**
     * Import expression - загрузка модуля как выражение
     */
    async evaluateImportExpression(expr) {
        const modulePath = expr.path;
        
        // Используем moduleSystem для загрузки модуля
        if (this.moduleSystem) {
            const moduleExports = await this.moduleSystem.loadModule(modulePath, this.currentFilename);
            return moduleExports;
        }
        
        throw new Error('Система модулей не инициализирована');
    }
    
    /**
     * Export - экспорт имен из модуля
     */
    async evaluateExportStatement(stmt) {
        const exports = {};
        
        for (const name of stmt.identifiers) {
            const value = this.currentEnv.get(name);
            if (value !== undefined) {
                exports[name] = value;
            }
        }
        
        // Сохраняем экспорты в специальном объекте
        if (!this.currentEnv.exports) {
            this.currentEnv.exports = exports;
        } else {
            Object.assign(this.currentEnv.exports, exports);
        }
        
        return VladXObject.null();
    }

    /**
     * Тернарный оператор
     */
    async evaluateTernaryExpression(expr) {
        const condition = await this.evaluateExpression(expr.condition);
        const condValue = condition && condition.value !== undefined ? condition.value : condition;
        
        if (condValue) {
            return await this.evaluateExpression(expr.thenExpr);
        }
        return await this.evaluateExpression(expr.elseExpr);
    }

    /**
     * Последовательность (a, b, c)
     */
    async evaluateSequenceExpression(expr) {
        let result = VladXObject.null();
        
        if (expr.expressions) {
            for (const e of expr.expressions) {
                result = await this.evaluateExpression(e);
            }
        }
        
        return result;
    }

    /**
     * Switch statement
     */
    async evaluateSwitchStatement(stmt) {
        const discriminant = await this.evaluateExpression(stmt.discriminant);
        const discriminantValue = discriminant && discriminant.value !== undefined ? discriminant.value : discriminant;

        let matched = false;
        let result = VladXObject.null();

        // Evaluate cases
        for (const caseStmt of stmt.cases) {
            if (!matched) {
                const caseValue = await this.evaluateExpression(caseStmt.test);
                const caseValueValue = caseValue && caseValue.value !== undefined ? caseValue.value : caseValue;

                // Strict equality comparison
                if (caseValueValue === discriminantValue) {
                    matched = true;
                }
            }

            if (matched) {
                // Execute case body
                for (const statement of caseStmt.consequent) {
                    try {
                        result = await this.evaluateStatement(statement);

                        // If we encounter a return, exit the switch
                        if (this.isReturn) {
                            return result;
                        }
                    } catch (e) {
                        // If it's a break statement, exit the entire switch
                        if (e.message === 'break') {
                            return result; // Exit the entire switch
                        } else {
                            // Re-throw other errors
                            throw e;
                        }
                    }
                }
            }
        }

        // If no case matched and there's a default case
        if (!matched && stmt.defaultCase) {
            for (const statement of stmt.defaultCase.consequent) {
                try {
                    result = await this.evaluateStatement(statement);

                    // If we encounter a return, exit the switch
                    if (this.isReturn) {
                        return result;
                    }
                } catch (e) {
                    // If it's a break statement, exit the entire switch
                    if (e.message === 'break') {
                        return result; // Exit the entire switch
                    } else {
                        // Re-throw other errors
                        throw e;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Вычисление выражения (обёртка)
     */
    async evaluate(expr) {
        if (expr === null || expr === undefined) {
            return VladXObject.null();
        }
        
        try {
            return await this.evaluateExpression(expr);
        } catch (e) {
            let errorMessage = e.message;
            if (!errorMessage) {
                errorMessage = `Ошибка типа: ${e.constructor.name}`;
                if (e.stack) {
                    errorMessage += `\nСтек вызовов: ${e.stack}`;
                } else {
                    errorMessage += ' (Стек вызовов недоступен)';
                }
            }
            throw new Error(errorMessage);
        }
    }

    /**
     * Очистка состояния после выполнения
     */
    cleanup() {
        this.callStack = [];
        this.isReturn = false;
        this.returnValue = null;
        this.errorHandler = null;
    }

    /**
     * Обёртка ошибки
     */
    wrapError(error) {
        if (error.message === 'break' || error.message === 'continue') {
            return error;
        }

        let errorMessage = error.toString ? error.toString() : String(error);
        if (!errorMessage) {
            // Если у ошибки нет сообщения, попробуем получить более подробную информацию
            errorMessage = `Ошибка типа: ${error.constructor.name}`;
            if (error.stack) {
                errorMessage += `\nСтек вызовов: ${error.stack}`;
            } else {
                errorMessage += ' (Стек вызовов недоступен)';
            }
        }
        const stackTrace = this.callStack.length > 0 ? `Стек вызовов: ${this.callStack.join(' -> ')}` : 'Стек вызовов пуст';
        return new Error(
            `[${this.currentFilename}] Ошибка выполнения: ${errorMessage}\n` +
            stackTrace
        );
    }

    /**
     * Выполнение catch
     */
    async executeCatch(handler, error) {
        if (!handler) return;
        
        const catchEnv = this.currentEnv.child('<catch>');
        if (handler.param) {
            catchEnv.define(handler.param, VladXObject.string(error.toString ? error.toString() : String(error)));
        }
        
        const previousEnv = this.currentEnv;
        this.currentEnv = catchEnv;
        
        if (handler.body && handler.body.body) {
            for (const statement of handler.body.body) {
                await this.evaluateStatement(statement);
            }
        }
        
        this.currentEnv = previousEnv;
    }
}

export default Interpreter;
