/**
 * VladX Engine — Основной движок языка
 * Объединяет лексер, парсер и интерпретатор
 */

import { Lexer } from '../lexer/lexer.js';
import { Parser } from '../parser/parser.js';
import { Interpreter } from '../interpreter/interpreter.js';
import { ModuleSystem } from '../runtime/module-system.js';
import { Builtins } from '../runtime/builtins.js';
import { VladXObject } from '../runtime/vladx-object.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class VladXEngine {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.strictMode = options.strictMode || false;
        this.maxExecutionTime = options.maxExecutionTime || 30000; // 30 секунд по умолчанию
        
        this.moduleSystem = new ModuleSystem(null);
        
        this.interpreter = new Interpreter({
            debug: this.debug,
            maxExecutionTime: this.maxExecutionTime,
            moduleSystem: this.moduleSystem
        });
        
        // Обновляем ссылку на интерпретатор в moduleSystem
        this.moduleSystem.interpreter = this.interpreter;
        
        this.builtins = new Builtins(this.interpreter);
        
        // Инициализируем пути node_modules
        this.updateNodeModulesPaths(process.cwd());
        
        // Регистрация встроенных модулей
        this.registerBuiltins();
    }
    
    /**
     * Обновление путей для поиска модулей в node_modules
     */
    updateNodeModulesPaths(projectPath) {
        const paths = [];
        
        // Добавляем локальную node_modules
        paths.push(join(projectPath, 'node_modules'));
        
        // Добавляем родительские node_modules (аналог Node.js)
        let currentPath = projectPath;
        const rootDir = process.env.HOME || process.env.USERPROFILE || '/';
        
        while (currentPath !== rootDir && currentPath !== '/' && currentPath !== 'C:\\') {
            currentPath = dirname(currentPath);
            paths.push(join(currentPath, 'node_modules'));
        }
        
        // Добавляем глобальные модули vladpm
        const globalPath = join(process.env.HOME || process.env.USERPROFILE, '.vladx', 'global_modules');
        paths.push(globalPath);
        
        this.moduleSystem.setNodeModulesPaths(paths);
    }

    /**
     * Форматирование значения для вывода
     */
    formatValue(arg) {
        // Проверяем, является ли это VladXObject
        if (arg && typeof arg === 'object' && arg.type !== undefined) {
            switch (arg.type) {
                case 'null':
                    return 'nothing';
                case 'string':
                    return arg.value;
                case 'number':
                    return String(arg.value);
                case 'boolean':
                    return arg.value ? 'истина' : 'ложь';
                case 'object':
                    // Красивый вывод объекта
                    const props = [];
                    for (const [key, val] of Object.entries(arg.value || {})) {
                        props.push(`${key}: ${this.formatValue(val)}`);
                    }
                    return '{ ' + props.join(', ') + ' }';
                case 'array':
                    const elements = (arg.value || []).map(v => this.formatValue(v));
                    return '[' + elements.join(', ') + ']';
                case 'function':
                    return `<функция ${arg.name}>`;
                default:
                    return String(arg.value);
            }
        }
        // Обычные объекты JS
        if (typeof arg === 'object' && arg !== null) {
            // Проверяем, не является ли это массивом
            if (Array.isArray(arg)) {
                return '[' + arg.map(v => this.formatValue(v)).join(', ') + ']';
            }
            return JSON.stringify(arg, null, 2);
        }
        return String(arg);
    }

    /**
     * Регистрация встроенных модулей и функций
     */
    registerBuiltins() {
        // Математические функции
        this.interpreter.builtins.set('максимум', (...args) => Math.max(...args));
        this.interpreter.builtins.set('минимум', (...args) => Math.min(...args));
        this.interpreter.builtins.set('случайный', () => Math.random());
        this.interpreter.builtins.set('случайноеЦелое', (min, max) => 
            Math.floor(Math.random() * (max - min + 1)) + min);
        this.interpreter.builtins.set('abs', (n) => Math.abs(n));
        this.interpreter.builtins.set('округлить', (n) => Math.round(n));
        this.interpreter.builtins.set('пол', (n) => Math.floor(n));
        this.interpreter.builtins.set('потолок', (n) => Math.ceil(n));
        this.interpreter.builtins.set('корень', (n) => Math.sqrt(n));
        this.interpreter.builtins.set('степень', (base, exp) => Math.pow(base, exp));
        this.interpreter.builtins.set('ln', (n) => Math.log(n));
        this.interpreter.builtins.set('log10', (n) => Math.log10(n));
        this.interpreter.builtins.set('sin', (n) => Math.sin(n));
        this.interpreter.builtins.set('cos', (n) => Math.cos(n));
        this.interpreter.builtins.set('tan', (n) => Math.tan(n));
        this.interpreter.builtins.set('asin', (n) => Math.asin(n));
        this.interpreter.builtins.set('acos', (n) => Math.acos(n));
        this.interpreter.builtins.set('atan', (n) => Math.atan(n));
        this.interpreter.builtins.set('пи', () => Math.PI);
        this.interpreter.builtins.set('e', () => Math.E);
        
        // Строковые функции
        this.interpreter.builtins.set('длина', (str) => str?.length ?? 0);
        this.interpreter.builtins.set('нижнийРегистр', (str) => str.toLowerCase());
        this.interpreter.builtins.set('верхнийРегистр', (str) => str.toUpperCase());
        this.interpreter.builtins.set('обрезка', (str) => str.trim());
        this.interpreter.builtins.set('заменить', (str, old, replacement) => 
            str.replaceAll(old, replacement));
        this.interpreter.builtins.set('разделить', (str, delimiter) => str.split(delimiter));
        this.interpreter.builtins.set('соединить', (arr, delimiter) => arr.join(delimiter));
        this.interpreter.builtins.set('подстрока', (str, start, end) => 
            str.substring(start, end));
        this.interpreter.builtins.set('кодСимвола', (str, index) => str.charCodeAt(index));
        this.interpreter.builtins.set('символПоКоду', (code) => String.fromCharCode(code));
        this.interpreter.builtins.set('код', (val) => JSON.stringify(val));
        this.interpreter.builtins.set('разкод', (str) => JSON.parse(str));
        
        // Функции для работы с массивами
        this.interpreter.builtins.set('создатьМассив', (...args) => {
            // Args are already native values since they came from nativeArgs
            return VladXObject.array([...args]);
        });
        this.interpreter.builtins.set('объединить', (...arrays) => {
            // Arrays are already native arrays since they came from nativeArgs
            const nativeArrays = arrays.map(arr => Array.isArray(arr) ? arr : []);
            return VladXObject.array(nativeArrays.reduce((acc, arr) => [...acc, ...arr], []));
        });
        this.interpreter.builtins.set('фильтр', (arr, callback) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return VladXObject.array(nativeArray.filter(callback));
        });
        this.interpreter.builtins.set('отобразить', (arr, callback) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return VladXObject.array(nativeArray.map(callback));
        });
        this.interpreter.builtins.set('уменьшить', (arr, callback, initial) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return nativeArray.reduce(callback, initial);
        });
        this.interpreter.builtins.set('найти', (arr, callback) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return nativeArray.find(callback);
        });
        this.interpreter.builtins.set('найтиИндекс', (arr, callback) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return nativeArray.findIndex(callback);
        });
        this.interpreter.builtins.set('включает', (arr, item) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return nativeArray.includes(item);
        });
        this.interpreter.builtins.set('сортировать', (arr, comparator) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return VladXObject.array([...nativeArray].sort(comparator));
        });
        this.interpreter.builtins.set('перевернуть', (arr) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return VladXObject.array([...nativeArray].reverse());
        });
        this.interpreter.builtins.set('копировать', (arr) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return VladXObject.array([...nativeArray]);
        });
        this.interpreter.builtins.set('пустой', (arr) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return nativeArray.length === 0;
        });
        this.interpreter.builtins.set('первый', (arr) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return nativeArray.length > 0 ? nativeArray[0] : undefined;
        });
        this.interpreter.builtins.set('последний', (arr) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return nativeArray.length > 0 ? nativeArray[nativeArray.length - 1] : undefined;
        });
        this.interpreter.builtins.set('хвост', (arr) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return VladXObject.array(nativeArray.length > 0 ? nativeArray.slice(1) : []);
        });
        this.interpreter.builtins.set('голова', (arr) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return VladXObject.array(nativeArray.length > 0 ? nativeArray.slice(0, -1) : []);
        });
        this.interpreter.builtins.set('добавить', (arr, item) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            const newArr = [...nativeArray];
            newArr.push(item);
            return VladXObject.array(newArr);
        });
        this.interpreter.builtins.set('вставить', (arr, index, item) => {
            // arr is already a native array since it came from nativeArgs
            if (!Array.isArray(arr)) {
                console.warn(`Предупреждение: функция 'вставить' ожидает массив, получено: ${typeof arr}`);
                return VladXObject.array([item]);
            }
            if (typeof index !== 'number' || !Number.isInteger(index)) {
                throw new Error(`Индекс должен быть целым числом, получено: ${typeof index} (${index})`);
            }
            if (index < 0 || index > arr.length) {
                throw new Error(`Индекс ${index} выходит за пределы допустимого диапазона [0, ${arr.length}]`);
            }
            const newArr = [...arr];
            newArr.splice(index, 0, item);
            return VladXObject.array(newArr);
        });
        this.interpreter.builtins.set('удалить', (arr, index) => {
            // arr is already a native array since it came from nativeArgs
            if (!Array.isArray(arr)) {
                console.warn(`Предупреждение: функция 'удалить' ожидает массив, получено: ${typeof arr}`);
                return VladXObject.array([]);
            }
            if (typeof index !== 'number' || !Number.isInteger(index)) {
                throw new Error(`Индекс должен быть целым числом, получено: ${typeof index} (${index})`);
            }
            if (index < 0 || index >= arr.length) {
                throw new Error(`Индекс ${index} выходит за пределы массива длиной ${arr.length}`);
            }
            const newArr = [...arr];
            newArr.splice(index, 1);
            return VladXObject.array(newArr);
        });
        this.interpreter.builtins.set('размер', (arr) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return nativeArray.length;
        });
        this.interpreter.builtins.set('каждый', (arr, callback) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return nativeArray.every(callback);
        });
        this.interpreter.builtins.set('некоторые', (arr, callback) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return nativeArray.some(callback);
        });
        this.interpreter.builtins.set('срез', (arr, start, end) => {
            // arr is already a native array since it came from nativeArgs
            if (!Array.isArray(arr)) {
                console.warn(`Предупреждение: функция 'срез' ожидает массив, получено: ${typeof arr}`);
                return VladXObject.array([]);
            }
            if (typeof start !== 'number' || !Number.isInteger(start)) {
                throw new Error(`Начальный индекс должен быть целым числом, получено: ${typeof start} (${start})`);
            }
            if (typeof end !== 'number' && end !== undefined) {
                throw new Error(`Конечный индекс должен быть числом или undefined, получено: ${typeof end} (${end})`);
            }
            if (start < 0) start = Math.max(0, arr.length + start);
            if (end !== undefined && end < 0) end = arr.length + end;
            if (start > arr.length) start = arr.length;
            if (end !== undefined && end > arr.length) end = arr.length;
            if (start < 0) start = 0;
            if (end !== undefined && end < 0) end = 0;

            return VladXObject.array(arr.slice(start, end));
        });
        this.interpreter.builtins.set('заполнить', (arr, value, start = 0, end = arr.length) => {
            // arr is already a native array since it came from nativeArgs
            if (!Array.isArray(arr)) {
                console.warn(`Предупреждение: функция 'заполнить' ожидает массив, получено: ${typeof arr}`);
                return VladXObject.array([]);
            }
            if (typeof start !== 'number' || !Number.isInteger(start)) {
                throw new Error(`Начальный индекс должен быть целым числом, получено: ${typeof start} (${start})`);
            }
            if (typeof end !== 'number' || !Number.isInteger(end)) {
                throw new Error(`Конечный индекс должен быть целым числом, получено: ${typeof end} (${end})`);
            }
            const newArr = [...arr];
            newArr.fill(value, start, end);
            return VladXObject.array(newArr);
        });
        this.interpreter.builtins.set('развернуть', (arr) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return VladXObject.array(nativeArray.flat());
        });
        this.interpreter.builtins.set('развернутьГлубоко', (arr, depth = 1) => {
            // arr is already a native array since it came from nativeArgs
            const nativeArray = Array.isArray(arr) ? arr : [];
            return VladXObject.array(nativeArray.flat(depth));
        });
        
        // Функции для работы с объектами
        this.interpreter.builtins.set('объект', (obj = {}) => {
            // obj is already a native object since it came from nativeArgs
            const nativeObj = obj && typeof obj === 'object' ? obj : {};
            return VladXObject.object({...nativeObj});
        });
        this.interpreter.builtins.set('ключи', (obj) => Object.keys(obj));
        this.interpreter.builtins.set('значения', (obj) => Object.values(obj));
        this.interpreter.builtins.set('пары', (obj) => Object.entries(obj));
        this.interpreter.builtins.set('слить', (...objects) => 
            objects.reduce((acc, obj) => ({...acc, ...obj}), {}));
        this.interpreter.builtins.set('из', (obj, key) => obj[key]);
        this.interpreter.builtins.set('в', (obj, key, value) => {
            const newObj = {...obj};
            newObj[key] = value;
            return newObj;
        });
        this.interpreter.builtins.set('удалитьСвойство', (obj, key) => {
            const newObj = {...obj};
            delete newObj[key];
            return newObj;
        });
        this.interpreter.builtins.set('проверить', (obj, key) => key in obj);
        
        // Системные функции
        const engine = this; // Capture engine reference for use in builtins
        this.interpreter.builtins.set('печать', (...args) => {
            console.log(...args.map(arg => engine.formatValue(arg)));
        });
        this.interpreter.builtins.set('вывод', (...args) => {
            process.stdout.write(args.map(arg => engine.formatValue(arg)).join(' '));
        });
        this.interpreter.builtins.set('ждать', (ms) => new Promise(resolve => 
            setTimeout(resolve, ms)));
        this.interpreter.builtins.set('время', () => Date.now());
        this.interpreter.builtins.set('дата', () => new Date());
        this.interpreter.builtins.set('форматДаты', (date, format) => {
            const pad = n => String(n).padStart(2, '0');
            return format
                .replace('YYYY', date.getFullYear())
                .replace('MM', pad(date.getMonth() + 1))
                .replace('DD', pad(date.getDate()))
                .replace('HH', pad(date.getHours()))
                .replace('mm', pad(date.getMinutes()))
                .replace('ss', pad(date.getSeconds()));
        });
        
        // Ввод от пользователя
        this.interpreter.builtins.set('ввести', async (prompt = '') => {
            const readline = await import('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            return new Promise((resolve) => {
                rl.question(prompt, (answer) => {
                    rl.close();
                    resolve(answer);
                });
            });
        });

        // Файловые операции (улучшенные)
        this.interpreter.builtins.set('файлЧитать', (path) => {
            try {
                return readFileSync(path, 'utf-8');
            } catch (e) {
                throw new VladXObject('error', `Не удалось прочитать файл: ${path}`);
            }
        });
        this.interpreter.builtins.set('файлЗаписать', (path, content) => {
            try {
                writeFileSync(path, content, 'utf-8');
                return true;
            } catch (e) {
                throw new VladXObject('error', `Не удалось записать файл: ${path}`);
            }
        });
        this.interpreter.builtins.set('файлСуществует', (path) => existsSync(path));
        
        // Сетевые функции (улучшенные)
        this.interpreter.builtins.set('запрос', async (url, options = {}) => {
            const https = await import('https');
            const http = await import('http');
            
            return new Promise((resolve, reject) => {
                const urlObj = new URL(url);
                const client = urlObj.protocol === 'https:' ? https : http;
                
                const req = client.request(url, {
                    method: options.method || 'GET',
                    headers: options.headers || {}
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (options.raw) {
                            resolve({ 
                                status: res.statusCode, 
                                headers: res.headers,
                                body: data 
                            });
                        } else {
                            try {
                                resolve(JSON.parse(data));
                            } catch {
                                resolve(data);
                            }
                        }
                    });
                });
                
                req.on('error', reject);
                if (options.body) {
                    req.write(options.body);
                }
                req.end();
            });
        });
        
        // Криптографические функции
        this.interpreter.builtins.set('хешMD5', async (str) => {
            const crypto = await import('crypto');
            return crypto.createHash('md5').update(str).digest('hex');
        });
        this.interpreter.builtins.set('хешSHA256', async (str) => {
            const crypto = await import('crypto');
            return crypto.createHash('sha256').update(str).digest('hex');
        });
        this.interpreter.builtins.set('генUUID', () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        });
        
        // Регулярные выражения
        this.interpreter.builtins.set('регex', (pattern, flags = '') => new RegExp(pattern, flags));
        this.interpreter.builtins.set('сопоставить', (str, regex) => str.match(regex));
        this.interpreter.builtins.set('заменитьРВ', (str, regex, replacement) => 
            str.replace(regex, replacement));
        this.interpreter.builtins.set('разбитьРВ', (str, regex) => str.split(regex));
        
        // Типы и проверки
        this.interpreter.builtins.set('тип', (val) => {
            // Проверяем, является ли это VladXObject
            if (val && typeof val === 'object' && val.type !== undefined) {
                switch (val.type) {
                    case 'null': return 'ничто';
                    case 'string': return 'строка';
                    case 'number': return 'число';
                    case 'boolean': return 'логический';
                    case 'array': return 'массив';
                    case 'object': return 'объект';
                    case 'function': return 'функция';
                    case 'closure': return 'замыкание';
                    case 'class': return 'класс';
                    case 'instance': return 'экземпляр';
                    default: return val.type;
                }
            }
            if (val === null) return 'ничто';
            if (val === undefined) return 'неопределено';
            if (Array.isArray(val)) return 'массив';
            return typeof val;
        });
        this.interpreter.builtins.set('этоЧисло', (val) => typeof val === 'number' && !isNaN(val));
        this.interpreter.builtins.set('этоСтрока', (val) => typeof val === 'string');
        this.interpreter.builtins.set('этоМассив', (val) => Array.isArray(val));
        this.interpreter.builtins.set('этоОбъект', (val) => typeof val === 'object' && val !== null && !Array.isArray(val));
        this.interpreter.builtins.set('этоФункция', (val) => typeof val === 'function');
        this.interpreter.builtins.set('этоЛогическое', (val) => typeof val === 'boolean');
        this.interpreter.builtins.set('этоПустой', (val) => {
            if (val === null || val === undefined) return true;
            if (typeof val === 'string') return val.length === 0;
            if (Array.isArray(val)) return val.length === 0;
            if (typeof val === 'object') return Object.keys(val).length === 0;
            return false;
        });
        
        // Конвертация типов
        this.interpreter.builtins.set('вСтроку', (val) => String(val));
        this.interpreter.builtins.set('вЧисло', (val) => {
            const n = Number(val);
            if (isNaN(n)) throw new VladXObject('error', 'Не удалось конвертировать в число');
            return n;
        });
        this.interpreter.builtins.set('вМассив', (val) => {
            if (Array.isArray(val)) return val;
            if (val === null || val === undefined) return [];
            return [val];
        });
        
        // Функциональное программирование
        this.interpreter.builtins.set('частичное', (fn, ...args) => 
            (...moreArgs) => fn(...args, ...moreArgs));
        this.interpreter.builtins.set('композиция', (...fns) => 
            (arg) => fns.reduce((acc, fn) => fn(acc), arg));
        this.interpreter.builtins.set('труба', (val, ...fns) => 
            fns.reduce((acc, fn) => fn(acc), val));
        this.interpreter.builtins.set('мемоизировать', (fn) => {
            const cache = new Map();
            return (...args) => {
                const key = JSON.stringify(args);
                if (cache.has(key)) return cache.get(key);
                const result = fn(...args);
                cache.set(key, result);
                return result;
            };
        });
        
        // Асинхронные утилиты
        this.interpreter.builtins.set('обещание', (executor) => new Promise(executor));
        this.interpreter.builtins.set('всеОбещания', (promises) => Promise.all(promises));
        this.interpreter.builtins.set('любоеОбещание', (promises) => Promise.any(promises));
        this.interpreter.builtins.set('всеОбещанияКакОбъект', async (obj) => {
            const keys = Object.keys(obj);
            const promises = Object.values(obj);
            const results = await Promise.all(promises);
            return keys.reduce((acc, key, i) => {
                acc[key] = results[i];
                return acc;
            }, {});
        });
        
        // Генераторы
        this.interpreter.builtins.set('диапазон', function* (start, end, step = 1) {
            if (end === undefined) {
                end = start;
                start = 0;
            }
            for (let i = start; step > 0 ? i < end : i > end; i += step) {
                yield i;
            }
        });
        this.interpreter.builtins.set('генерировать', function* (callback) {
            let index = 0;
            while (true) {
                const result = callback(index++);
                if (result.done) break;
                yield result.value;
            }
        });
        
        // Бинарные операции
        this.interpreter.builtins.set('битИ', (a, b) => a & b);
        this.interpreter.builtins.set('битИЛИ', (a, b) => a | b);
        this.interpreter.builtins.set('битИСКЛ', (a, b) => a ^ b);
        this.interpreter.builtins.set('битНЕ', (a) => ~a);
        this.interpreter.builtins.set('сдвигВлево', (a, n) => a << n);
        this.interpreter.builtins.set('сдвигВправо', (a, n) => a >> n);
        this.interpreter.builtins.set('беззнаковыйСдвиг', (a, n) => a >>> n);
    }

    /**
     * Выполнение кода из строки (асинхронное)
     */
    async execute(source, options = {}) {
        const filename = options.filename || '<anonymous>';
        const context = options.context || null;
        
        if (this.debug) {
            console.log(`[VladX] Начинаем выполнение: ${filename}`);
        }
        
        try {
            if (this.debug) {
            console.log('[Engine] Starting lexing');
        }
            // Лексический анализ
            const lexer = new Lexer(source, filename);
            const tokens = lexer.tokenize();
            if (this.debug) {
            console.log('[Engine] Tokens count:', tokens.length);
        }
            
            if (this.debug) {
                console.log(`[VladX] Получено токенов: ${tokens.length}`);
            }
            
            if (this.debug) {
            console.log('[Engine] Starting parsing');
        }
            // Синтаксический анализ
            const parser = new Parser(tokens, { debug: this.debug });
            const ast = parser.parse();
            if (this.debug) {
            console.log('[Engine] AST body length:', ast.body.length);
        }
            
            if (this.debug) {
                console.log(`[VladX] AST создан: ${ast.body.length} узлов`);
            }
            
            if (this.debug) {
            console.log('[Engine] Starting interpretation');
        }
            // Интерпретация
            const result = await this.interpreter.interpret(ast, {
                filename,
                context,
                modulePath: options.modulePath || process.cwd()
            });
            
            if (this.debug) {
            console.log('[VladX] Raw result:', result);
            console.log('[VladX] Result type:', result?.type);
            console.log('[VladX] Result value:', result?.value);
        }
            
            if (this.debug) {
                console.log(`[VladX] Результат:`, result);
            }
            
            return result;
        } catch (error) {
            if (error instanceof VladXObject && error.type === 'error') {
                throw error;
            }
            // Получаем сообщение об ошибке или используем более подробное описание
            let errorMessage = error.toString ? error.toString() : String(error);
            if (!errorMessage) {
                errorMessage = `Ошибка типа: ${error.constructor.name}`;
                if (error.stack) {
                    errorMessage += `\nСтек вызовов: ${error.stack}`;
                } else {
                    errorMessage += ' (Стек вызовов недоступен)';
                }
            }
            throw new VladXObject('error', errorMessage, {
                stack: error.stack
            });
        }
    }

    /**
     * Выполнение файла
     */
    async executeFile(filepath) {
        const { readFileSync, existsSync } = await import('fs');
        const { dirname, join } = await import('path');
        const { fileURLToPath } = await import('url');
        
        const __dirname = dirname(fileURLToPath(import.meta.url));
        
        if (!existsSync(filepath)) {
            throw new VladXObject('error', `Файл не найден: ${filepath}`);
        }
        
        // Обновляем пути node_modules для текущего проекта
        this.updateNodeModulesPaths(dirname(filepath));
        
        const source = readFileSync(filepath, 'utf-8');
        const modulePath = dirname(filepath);
        
        return this.execute(source, {
            filename: filepath,
            modulePath
        });
    }

    /**
     * REPL режим
     */
    async repl(inputStream = process.stdin, outputStream = process.stdout) {
        const readline = await import('readline');
        
        const rl = readline.createInterface({
            input: inputStream,
            output: outputStream,
            prompt: 'vladx> '
        });
        
        let buffer = '';
        let parenCount = 0;
        let braceCount = 0;
        let indentLevel = 0;
        
        rl.setPrompt('vladx» ');
        rl.prompt();
        
        rl.on('line', async (line) => {
            buffer += line + '\n';
            
            // Проверка на завершение блока
            for (const char of line) {
                if (char === '(') parenCount++;
                if (char === ')') parenCount--;
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            
            // Проверка отступов
            const trimmed = line.trim();
            if (trimmed.endsWith('{')) {
                indentLevel++;
            } else if (trimmed.startsWith('}') || trimmed.startsWith('иначе')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            if (parenCount === 0 && braceCount === 0 && line.trim()) {
                try {
                    const result = this.execute(buffer, { filename: '<repl>' });
                    if (result !== undefined) {
                        outputStream.write(`→ ${JSON.stringify(result, null, 2)}\n`);
                    }
                } catch (error) {
                    outputStream.write(`Ошибка: ${error.toString ? error.toString() : String(error)}\n`);
                }
                
                buffer = '';
                parenCount = 0;
                braceCount = 0;
                indentLevel = 0;
                rl.setPrompt('vladx» ');
            } else {
                rl.setPrompt('     ' + '  '.repeat(indentLevel) + '· ');
            }
            
            rl.prompt();
        });
        
        rl.on('close', () => {
            outputStream.write('\nДо встречи!\n');
        });
    }

    /**
     * Компиляция в JavaScript (транспиляция)
     */
    compile(source) {
        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        return this.astToJs(ast);
    }

    /**
     * Преобразование AST в JavaScript код
     */
    astToJs(ast) {
        // Базовое преобразование AST в JS
        return ast.body.map(node => this.nodeToJs(node)).join(';\n');
    }

    /**
     * Преобразование отдельного узла AST в JS
     */
    nodeToJs(node) {
        switch (node.type) {
            case 'Program':
                return node.body.map(n => this.nodeToJs(n)).join(';\n');
            
            case 'LetStatement':
                const init = node.initializer ? this.nodeToJs(node.initializer) : 'undefined';
                return `let ${node.name} = ${init}`;
            
            case 'ConstStatement':
                const constInit = node.initializer ? this.nodeToJs(node.initializer) : 'undefined';
                return `const ${node.name} = ${constInit}`;
            
            case 'ReturnStatement':
                return `return ${node.value ? this.nodeToJs(node.value) : 'undefined'}`;
            
            case 'ExpressionStatement':
                return this.nodeToJs(node.expression);
            
            case 'BinaryExpression':
                const left = this.nodeToJs(node.left);
                const right = this.nodeToJs(node.right);
                return `(${left} ${node.operator} ${right})`;
            
            case 'UnaryExpression':
                const operand = this.nodeToJs(node.operand);
                return `${node.operator}${operand}`;
            
            case 'Identifier':
                return node.name;
            
            case 'Literal':
                return JSON.stringify(node.value);
            
            case 'FunctionDeclaration':
                const params = node.parameters.map(p => p.name).join(', ');
                const body = node.body.map(b => this.nodeToJs(b)).join(';\n');
                return `function ${node.name}(${params}) { ${body} }`;
            
            case 'CallExpression':
                const args = node.arguments.map(a => this.nodeToJs(a)).join(', ');
                return `${node.callee}(${args})`;
            
            case 'IfStatement':
                const condition = this.nodeToJs(node.condition);
                const thenBranch = node.thenBranch.map(b => this.nodeToJs(b)).join(';\n');
                let result = `if (${condition}) { ${thenBranch} }`;
                if (node.elseBranch) {
                    const elseBranch = node.elseBranch.map(b => this.nodeToJs(b)).join(';\n');
                    result += ` else { ${elseBranch} }`;
                }
                return result;
            
            case 'WhileStatement':
                const whileCond = this.nodeToJs(node.condition);
                const whileBody = node.body.map(b => this.nodeToJs(b)).join(';\n');
                return `while (${whileCond}) { ${whileBody} }`;
            
            case 'ForStatement':
                const forInit = this.nodeToJs(node.initializer);
                const forCond = this.nodeToJs(node.condition);
                const forUpdate = this.nodeToJs(node.update);
                const forBody = node.body.map(b => this.nodeToJs(b)).join(';\n');
                return `for (${forInit}; ${forCond}; ${forUpdate}) { ${forBody} }`;
            
            case 'ClassDeclaration':
                const methods = node.methods.map(m => {
                    const methodParams = m.parameters.map(p => p.name).join(', ');
                    const methodBody = m.body.map(b => this.nodeToJs(b)).join(';\n');
                    return `${m.name}(${methodParams}) { ${methodBody} }`;
                }).join(', ');
                return `class ${node.name} { ${methods} }`;
            
            case 'MemberExpression':
                const obj = this.nodeToJs(node.object);
                const prop = this.nodeToJs(node.property);
                return `${obj}.${prop}`;
            
            default:
                throw new Error(`Неизвестный тип узла: ${node.type}`);
        }
    }
}

export default VladXEngine;
