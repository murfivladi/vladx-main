/**
 * AdvancedTypeSystem — Расширенная система типов
 */

import { TypeSystem } from './type-system.js';

export class AdvancedTypeSystem extends TypeSystem {
    constructor() {
        super();
        this.typeAliases = new Map();
        this.unionTypes = new Map();
        this.intersectionTypes = new Map();
        this.genericTypes = new Map();
        this.initializeAdvancedTypes();
    }

    /**
     * Инициализация расширенных типов
     */
    initializeAdvancedTypes() {
        // Union types
        this.types.set('числоилистрока', {
            name: 'числоилистрока',
            check: (value) => {
                if (value && typeof value === 'object' && 'value' in value) {
                    return value.type === 'number' || value.type === 'string';
                }
                return typeof value === 'number' || typeof value === 'string';
            },
            defaultValue: 0
        });

        // Tuple types (массивы фиксированной длины)
        this.types.set('пара', {
            name: 'пара',
            check: (value) => Array.isArray(value) && value.length === 2,
            defaultValue: [null, null]
        });

        this.types.set('тройка', {
            name: 'тройка',
            check: (value) => Array.isArray(value) && value.length === 3,
            defaultValue: [null, null, null]
        });
    }

    /**
     * Создать union type
     */
    createUnionType(name, ...typeNames) {
        const typeCheckers = typeNames.map(tn => {
            const typeDef = this.types.get(tn);
            return typeDef ? typeDef.check : (() => false);
        });

        this.unionTypes.set(name, typeNames);
        this.types.set(name, {
            name,
            check: (value) => typeCheckers.some(checker => checker(value)),
            defaultValue: this.types.get(typeNames[0])?.defaultValue || null
        });

        return this;
    }

    /**
     * Создать intersection type
     */
    createIntersectionType(name, ...typeNames) {
        const typeCheckers = typeNames.map(tn => {
            const typeDef = this.types.get(tn);
            return typeDef ? typeDef.check : (() => true);
        });

        this.intersectionTypes.set(name, typeNames);
        this.types.set(name, {
            name,
            check: (value) => typeCheckers.every(checker => checker(value)),
            defaultValue: null
        });

        return this;
    }

    /**
     * Создать generic type
     */
    createGenericType(name, baseTypeName) {
        const baseType = this.types.get(baseTypeName);
        if (!baseType) {
            throw new Error(`Базовый тип не найден: ${baseTypeName}`);
        }

        this.genericTypes.set(name, {
            baseType: baseTypeName,
            typeParameters: []
        });

        this.types.set(name, {
            name,
            check: baseType.check,
            defaultValue: baseType.defaultValue
        });

        return this;
    }

    /**
     * Создать alias для типа
     */
    createTypeAlias(aliasName, originalTypeName) {
        const originalType = this.types.get(originalTypeName);
        if (!originalType) {
            throw new Error(`Тип не найден: ${originalTypeName}`);
        }

        this.typeAliases.set(aliasName, originalTypeName);
        this.types.set(aliasName, originalType);

        return this;
    }

    /**
     * Инференс типа с поддержкой union и intersection
     */
    inferType(value) {
        if (value === null || value === undefined) return 'ничто';

        // Если это VladXObject
        if (value && typeof value === 'object' && 'type' in value) {
            switch (value.type) {
                case 'number': return 'число';
                case 'string': return 'строка';
                case 'boolean': return 'логический';
                case 'array':
                    // Проверка на tuple types
                    if (Array.isArray(value.value)) {
                        if (value.value.length === 2) return 'пара';
                        if (value.value.length === 3) return 'тройка';
                    }
                    return 'массив';
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
        if (Array.isArray(value)) {
            if (value.length === 2) return 'пара';
            if (value.length === 3) return 'тройка';
            return 'массив';
        }
        if (typeof value === 'function') return 'функция';
        if (typeof value === 'object') return 'объект';
        return 'любой';
    }

    /**
     * Проверить совместимость типов
     */
    isTypeCompatible(type1, type2) {
        if (type1 === type2) return true;
        if (type1 === 'любой' || type2 === 'любой') return true;

        // Проверка union types
        if (this.unionTypes.has(type1)) {
            const types = this.unionTypes.get(type1);
            return types.includes(type2);
        }

        if (this.unionTypes.has(type2)) {
            const types = this.unionTypes.get(type2);
            return types.includes(type1);
        }

        // Проверка type aliases
        if (this.typeAliases.has(type1)) {
            const original = this.typeAliases.get(type1);
            return this.isTypeCompatible(original, type2);
        }

        if (this.typeAliases.has(type2)) {
            const original = this.typeAliases.get(type2);
            return this.isTypeCompatible(type1, original);
        }

        return false;
    }

    /**
     * Получить все типы
     */
    getAllTypes() {
        return {
            basic: Array.from(this.types.keys()),
            unions: Array.from(this.unionTypes.keys()),
            intersections: Array.from(this.intersectionTypes.keys()),
            generics: Array.from(this.genericTypes.keys()),
            aliases: Array.from(this.typeAliases.keys())
        };
    }
}

export default AdvancedTypeSystem;
