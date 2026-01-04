/**
 * VladX Builtins — Встроенные модули и функции
 */

import { VladXObject } from './vladx-object.js';

export class Builtins {
    constructor(interpreter) {
        this.interpreter = interpreter;
        this.modules = new Map();
        this.registerCoreModules();
    }

    /**
     * Регистрация основных модулей
     */
    registerCoreModules() {
        // Модуль для работы с консолью
        this.modules.set('консоль', {
            печать: (...args) => {
                console.log(...args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ));
                return VladXObject.null();
            },
            вывод: (...args) => {
                process.stdout.write(args.join(' '));
                return VladXObject.null();
            },
            ошибка: (...args) => {
                console.error(...args);
                return VladXObject.null();
            },
            время: () => {
    const now = new Date();
    return VladXObject.object({
        миллисекунды: now.getTime(),
        год: now.getFullYear(),
        месяц: now.getMonth() + 1,
        день: now.getDate(),
        час: now.getHours(),
        минута: now.getMinutes(),
        секунда: now.getSeconds()
    });
}

        });

        // Модуль для работы с файловой системой
        this.modules.set('файловаяСистема', {
            существует: async (path) => {
                const fs = await import('fs');
                return VladXObject.boolean(fs.existsSync(path));
            },
            читать: async (path) => {
                const fs = await import('fs');
                try {
                    return VladXObject.string(fs.readFileSync(path, 'utf-8'));
                } catch (e) {
                    throw new Error(`Не удалось прочитать файл: ${e.message}`);
                }
            },
            писать: async (path, content) => {
                const fs = await import('fs');
                try {
                    fs.writeFileSync(path, content, 'utf-8');
                    return VladXObject.boolean(true);
                } catch (e) {
                    throw new Error(`Не удалось записать файл: ${e.message}`);
                }
            }
        });

        // Модуль для работы с JSON
        this.modules.set('json', {
            сериализовать: (obj) => {
                try {
                    return VladXObject.string(JSON.stringify(obj));
                } catch (e) {
                    throw new Error(`Ошибка сериализации: ${e.message}`);
                }
            },
            десериализовать: (str) => {
                try {
                    return VladXObject.object(JSON.parse(str));
                } catch (e) {
                    throw new Error(`Ошибка десериализации: ${e.message}`);
                }
            }
        });

        // Модуль для работы с датой и временем
        this.modules.set('дата', {
            сейчас: () => {
                return VladXObject.object({
                    год: new Date().getFullYear(),
                    месяц: new Date().getMonth() + 1,
                    день: new Date().getDate(),
                    час: new Date().getHours(),
                    минута: new Date().getMinutes(),
                    секунда: new Date().getSeconds()
                });
            },
            миллисекунды: () => {
                return VladXObject.number(Date.now());
            }
        });
    }

    /**
     * Загрузка модуля
     */
    loadModule(moduleName) {
        if (this.modules.has(moduleName)) {
            return this.modules.get(moduleName);
        }
        
        // Попытка загрузить внешний модуль
        try {
            const modulePath = require.resolve(moduleName);
            const module = require(modulePath);
            return module;
        } catch (e) {
            throw new Error(`Модуль "${moduleName}" не найден`);
        }
    }

    /**
     * Импорт модуля
     */
    importModule(moduleName, options = {}) {
        const module = this.loadModule(moduleName);
        
        // Создание объекта модуля
        const moduleObj = VladXObject.object({});
        
        for (const [key, value] of Object.entries(module)) {
            if (typeof value === 'function') {
                moduleObj.value[key] = VladXObject.function(value, key);
            } else {
                moduleObj.value[key] = VladXObject.object(value);
            }
        }
        
        return moduleObj;
    }
}

export default Builtins;
