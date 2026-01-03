/**
 * VladX Environment — Окружение выполнения
 * Управляет областями видимости переменных
 */

export class Environment {
    constructor(parent = null, name = '<anonymous>') {
        this.parent = parent;
        this.name = name;
        this.variables = new Map();
        this.constants = new Set();
    }

    /**
     * Определение переменной
     */
    define(name, value, isConst = false) {
        // Check if it's already defined as a constant in the current environment only
        // Local variables should be able to shadow parent constants/functions
        if (this.constants.has(name)) {
            throw new Error(`Константа ${name} уже объявлена`);
        }

        if (this.variables.has(name) && !isConst) {
            // Предупреждение о переопределении
        }

        this.variables.set(name, value);

        if (isConst) {
            this.constants.add(name);
        }
    }

    /**
     * Получение значения переменной
     */
    get(name) {
        if (this.variables.has(name)) {
            return this.variables.get(name);
        }
        
        if (this.parent) {
            return this.parent.get(name);
        }
        
        return undefined;
    }

    /**
     * Присваивание значения переменной
     */
    assign(name, value) {
        if (this.variables.has(name)) {
            if (this.constants.has(name)) {
                throw new Error(`Нельзя изменить константу ${name}`);
            }
            this.variables.set(name, value);
            return true;
        }
        
        if (this.parent) {
            return this.parent.assign(name, value);
        }
        
        throw new Error(`Переменная ${name} не найдена`);
    }

    /**
     * Проверка существования переменной
     */
    has(name) {
        return this.variables.has(name) || (this.parent && this.parent.has(name));
    }

    /**
     * Создание дочернего окружения
     */
    child(name = '<child>') {
        return new Environment(this, name);
    }

    /**
     * Клонирование окружения
     */
    clone() {
        const cloned = new Environment(this.parent, this.name);
        
        for (const [key, value] of this.variables) {
            cloned.variables.set(key, value);
        }
        
        for (const constant of this.constants) {
            cloned.constants.add(constant);
        }
        
        return cloned;
    }

    /**
     * Получение всех переменных
     */
    getAll() {
        const result = {};
        
        if (this.parent) {
            Object.assign(result, this.parent.getAll());
        }
        
        for (const [key, value] of this.variables) {
            result[key] = value;
        }
        
        return result;
    }

    /**
     * Удаление переменной
     */
    delete(name) {
        if (this.variables.has(name)) {
            this.variables.delete(name);
            this.constants.delete(name);
            return true;
        }
        
        return false;
    }

    /**
     * Очистка окружения
     */
    clear() {
        this.variables.clear();
        this.constants.clear();
    }
}

export default Environment;
