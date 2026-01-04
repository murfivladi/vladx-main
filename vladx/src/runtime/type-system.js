/**
 * VladX Type System — Система типов для статической типизации
 */

import { VladXObject } from './vladx-object.js';

export class TypeSystem {
    constructor() {
        this.types = new Map();
        this.initializeBuiltInTypes();
    }

    /**
     * Инициализация встроенных типов
     */
    initializeBuiltInTypes() {
        // Базовые типы
        this.types.set('число', {
            name: 'число',
            check: (value) => {
                if (value && typeof value === 'object' && 'value' in value) {
                    return typeof value.value === 'number' && !isNaN(value.value);
                }
                return typeof value === 'number' && !isNaN(value);
            },
            defaultValue: 0
        });

        this.types.set('строка', {
            name: 'строка',
            check: (value) => {
                if (value && typeof value === 'object' && 'value' in value) {
                    return typeof value.value === 'string';
                }
                return typeof value === 'string';
            },
            defaultValue: ''
        });

        this.types.set('логический', {
            name: 'логический',
            check: (value) => {
                if (value && typeof value === 'object' && 'value' in value) {
                    return typeof value.value === 'boolean';
                }
                return typeof value === 'boolean';
            },
            defaultValue: false
        });

        this.types.set('ничто', {
            name: 'ничто',
            check: (value) => {
                if (value && typeof value === 'object' && 'value' in value) {
                    return value.value === null || value.value === undefined;
                }
                return value === null || value === undefined;
            },
            defaultValue: null
        });

        this.types.set('любой', {
            name: 'любой',
            check: (value) => true, // Принимает любое значение
            defaultValue: null
        });
    }

    /**
     * Проверка соответствия значения типу
     */
    checkType(value, typeAnnotation) {
        if (!typeAnnotation) return true; // Без аннотации типа - всегда ок

        switch (typeAnnotation.type) {
            case 'SimpleType':
                const typeDef = this.types.get(typeAnnotation.name);
                if (!typeDef) {
                    throw new Error(`Неизвестный тип: ${typeAnnotation.name}`);
                }
                return typeDef.check(value);

            case 'ArrayType':
                if (!Array.isArray(value)) return false;
                // Для массивов проверяем тип элементов если нужно
                return true; // Пока без строгой проверки элементов

            case 'FunctionType':
                return typeof value === 'function';

            case 'ObjectType':
                return typeof value === 'object' && value !== null && !Array.isArray(value);

            default:
                return true; // Неизвестный тип - пропускаем
        }
    }

    /**
     * Инференс типа из значения
     */
    inferType(value) {
        if (value === null || value === undefined) return 'ничто';

        // Если это VladXObject
        if (value && typeof value === 'object' && 'type' in value) {
            switch (value.type) {
                case 'number': return 'число';
                case 'string': return 'строка';
                case 'boolean': return 'логический';
                case 'array': return 'массив';
                case 'object': return 'объект';
                case 'function':
                case 'closure': return 'функция';
                case 'null': return 'ничто';
                default: return 'любой';
            }
        }

        if (typeof value === 'number') return 'число';
        if (typeof value === 'string') return 'строка';
        if (typeof value === 'boolean') return 'логический';
        if (Array.isArray(value)) return 'массив';
        if (typeof value === 'function') return 'функция';
        if (typeof value === 'object') return 'объект';
        return 'любой';
    }

    /**
     * Преобразование значения к типу
     */
    coerceValue(value, typeAnnotation) {
        if (!typeAnnotation) return value;

        switch (typeAnnotation.type) {
            case 'SimpleType':
                const typeName = typeAnnotation.name;
                const typeDef = this.types.get(typeName);
                if (!typeDef) return value;

                // Если значение уже правильного типа
                if (typeDef.check(value)) return value;

                // Попытка преобразования
                switch (typeName) {
                    case 'число':
                        const num = Number(value);
                        return isNaN(num) ? typeDef.defaultValue : num;
                    case 'строка':
                        return String(value);
                    case 'логический':
                        return Boolean(value);
                    default:
                        return typeDef.defaultValue;
                }

            default:
                return value;
        }
    }

    /**
     * Проверка типов в AST
     */
    checkAST(ast, environment) {
        // Простая проверка типов - можно расширить
        this.checkNode(ast, environment);
    }

    checkNode(node, environment) {
        switch (node.type) {
            case 'LetStatement':
            case 'ConstStatement':
                if (node.typeAnnotation) {
                    const value = this.evaluateForTypeCheck(node.initializer, environment);
                    if (!this.checkType(value, node.typeAnnotation)) {
                        console.warn(`Предупреждение типа: переменная ${node.name} имеет тип, не соответствующий аннотации`);
                    }
                }
                break;

            case 'FunctionDeclaration':
                // Проверка типов параметров и возвращаемого значения
                if (node.returnType) {
                    // Можно добавить проверку возвращаемых значений
                }
                break;

            case 'BinaryExpression':
                // Проверка типов операндов
                const left = this.evaluateForTypeCheck(node.left, environment);
                const right = this.evaluateForTypeCheck(node.right, environment);

                // Для арифметических операций оба операнда должны быть числами
                if (['+', '-', '*', '/', '%', '**'].includes(node.operator)) {
                    if (typeof left !== 'number' || typeof right !== 'number') {
                        console.warn(`Предупреждение типа: операция ${node.operator} требует числовые операнды`);
                    }
                }
                break;
        }

        // Рекурсивная проверка дочерних узлов
        for (const key in node) {
            if (node[key] && typeof node[key] === 'object' && node[key].type) {
                this.checkNode(node[key], environment);
            } else if (Array.isArray(node[key])) {
                node[key].forEach(item => {
                    if (item && typeof item === 'object' && item.type) {
                        this.checkNode(item, environment);
                    }
                });
            }
        }
    }

    /**
     * Оценка выражения для проверки типов (упрощенная версия)
     */
    evaluateForTypeCheck(expr, environment) {
        if (!expr) return null;

        switch (expr.type) {
            case 'Literal':
                return expr.value;
            case 'Identifier':
                return environment.get(expr.name)?.value || null;
            case 'BinaryExpression':
                const left = this.evaluateForTypeCheck(expr.left, environment);
                const right = this.evaluateForTypeCheck(expr.right, environment);
                if (typeof left === 'number' && typeof right === 'number') {
                    switch (expr.operator) {
                        case '+': return left + right;
                        case '-': return left - right;
                        case '*': return left * right;
                        case '/': return right !== 0 ? left / right : 0;
                    }
                }
                return null;
            default:
                return null;
        }
    }
}