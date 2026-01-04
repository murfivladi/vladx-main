/**
 * VladX Object — Объектная система языка
 * Реализует типы данных и обёртки для значений
 */

// Типы данных
export const types = {
    NULL: 'null',
    NUMBER: 'number',
    STRING: 'string',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
    FUNCTION: 'function',
    CLOSURE: 'closure',
    NATIVE: 'native',
    CLASS: 'class',
    INSTANCE: 'instance',
    ERROR: 'error'
};

/**
 * Базовый класс для всех значений VladX
 */
export class VladXObject {
    constructor(type, value = null, options = {}) {
        this.type = type;
        this.value = value;
        this.isNative = options.isNative || false;
        this.env = options.env || null;
        this.name = options.name || null;
        this.prototype = options.prototype || null;
        this.methods = options.methods || new Map();
        this.staticMethods = options.staticMethods || new Map();
        this.ast = options.ast || null;
    }

    // Фабричные методы для создания объектов разных типов

    static null() {
        return new VladXObject(types.NULL, null);
    }

    static number(value) {
        return new VladXObject(types.NUMBER, Number(value));
    }

    static string(value) {
        return new VladXObject(types.STRING, String(value));
    }

    static boolean(value) {
        return new VladXObject(types.BOOLEAN, Boolean(value));
    }

    static array(value) {
        return new VladXObject(types.ARRAY, value);
    }

    static object(value) {
        return new VladXObject(types.OBJECT, value || {});
    }

    static function(value, name = '<function>') {
        return new VladXObject(types.FUNCTION, value, { name, isNative: true });
    }

    static closure(ast, env, name = '<closure>') {
        return new VladXObject(types.CLOSURE, null, { env, name, ast });
    }

    static class(name, methods = new Map(), staticMethods = new Map(), superClass = null) {
        return new VladXObject(types.CLASS, null, { name, methods, staticMethods, prototype: superClass });
    }

    static instance(classObj) {
        return new VladXObject(types.INSTANCE, {}, {
            prototype: classObj,
            name: classObj.name
        });
    }

    /**
     * Создать VladXObject из обычного JS-значения
     */
    static fromJS(value) {
        if (value === null || value === undefined) {
            return VladXObject.null();
        }
        if (typeof value === 'number') {
            return VladXObject.number(value);
        }
        if (typeof value === 'string') {
            return VladXObject.string(value);
        }
        if (typeof value === 'boolean') {
            return VladXObject.boolean(value);
        }
        if (Array.isArray(value)) {
            return VladXObject.array(value);
        }
        if (typeof value === 'object') {
            return VladXObject.object(value);
        }
        return VladXObject.string(String(value));
    }

    /**
     * Получить "сырое" значение для операций
     */
    getRawValue() {
        if (this.value === null || this.value === undefined) {
            return null;
        }
        return this.value;
    }

    // Методы проверки типа

    isNull() {
        return this.type === types.NULL;
    }

    isNumber() {
        return this.type === types.NUMBER;
    }

    isString() {
        return this.type === types.STRING;
    }

    isBoolean() {
        return this.type === types.BOOLEAN;
    }

    isArray() {
        return this.type === types.ARRAY;
    }

    isObject() {
        return this.type === types.OBJECT;
    }

    isFunction() {
        return this.type === types.FUNCTION;
    }

    isClosure() {
        return this.type === types.CLOSURE;
    }

    isNativeFunction() {
        return this.type === types.FUNCTION && this.isNative;
    }

    isClass() {
        return this.type === types.CLASS;
    }

    isInstance() {
        return this.type === types.INSTANCE;
    }

    isError() {
        return this.type === types.ERROR;
    }

    // Преобразование в строку

    toString() {
        if (this.value === null) {
            return 'ничто';
        }
        
        if (this.type === types.STRING) {
            return this.value;
        }
        
        if (this.type === types.NUMBER) {
            return String(this.value);
        }
        
        if (this.type === types.BOOLEAN) {
            return this.value ? 'истина' : 'ложь';
        }
        
        if (this.type === types.ARRAY) {
            return '[' + this.value.map(v => v?.toString() || String(v)).join(', ') + ']';
        }
        
        if (this.type === types.OBJECT) {
            const props = Object.entries(this.value || {})
                .map(([k, v]) => `${k}: ${v?.toString() || String(v)}`)
                .join(', ');
            return '{' + props + '}';
        }
        
        if (this.type === types.FUNCTION || this.type === types.CLOSURE) {
            return `[функция: ${this.name}]`;
        }
        
        if (this.type === types.CLASS) {
            return `[класс: ${this.name}]`;
        }
        
        if (this.type === types.INSTANCE) {
            return `[экземпляр ${this.name}]`;
        }
        
        return String(this.value);
    }

    // Глубокое копирование

    clone() {
        return new VladXObject(
            this.type,
            this.cloneValue(this.value),
            {
                isNative: this.isNative,
                env: this.env,
                name: this.name,
                prototype: this.prototype,
                methods: this.methods
            }
        );
    }

    cloneValue(val) {
        if (val === null || val === undefined) {
            return val;
        }
        
        if (Array.isArray(val)) {
            return val.map(v => this.cloneValue(v));
        }
        
        if (typeof val === 'object') {
            const cloned = {};
            for (const key in val) {
                cloned[key] = this.cloneValue(val[key]);
            }
            return cloned;
        }
        
        return val;
    }
}

export default VladXObject;
