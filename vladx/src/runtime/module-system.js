/**
 * VladX Module System — Система модулей
 * Управляет импортом и экспортом модулей, включая поддержку пакетов vladpm
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join, extname, isAbsolute, basename } from 'path';
import { fileURLToPath } from 'url';
import { Lexer } from '../lexer/lexer.js';
import { Parser } from '../parser/parser.js';
const __dirname = dirname(fileURLToPath(import.meta.url));

export class ModuleSystem {
    constructor(interpreter) {
        this.interpreter = interpreter;
        this.loadedModules = new Map();
        this.moduleCache = new Map();
        
        // Пути для поиска модулей (аналог Node.js modules paths)
        this.nodeModulesPaths = [];
    }
    
    /**
     * Установка путей для поиска модулей
     */
    setNodeModulesPaths(paths) {
        this.nodeModulesPaths = paths;
    }
    
    /**
     * Проверка, является ли путь пакетом (а не файлом)
     */
    isPackageName(modulePath) {
        // Пакеты не начинаются с ./ или .. или /
        // Могут быть @-scoped (@scope/package)
        return !modulePath.startsWith('./') && 
               !modulePath.startsWith('../') && 
               !modulePath.startsWith('/') &&
               modulePath.length > 0;
    }
    
    /**
     * Разбор имени пакета
     */
    parsePackageName(name) {
        // Проверка на scoped package (@scope/name)
        const scopedMatch = name.match(/^@([^/]+)\/(.+)$/);
        if (scopedMatch) {
            return {
                scope: scopedMatch[1],
                name: scopedMatch[2],
                fullName: name
            };
        }
        
        // Обычный пакет
        return {
            scope: null,
            name: name,
            fullName: name
        };
    }
    
    /**
     * Поиск модуля в node_modules по имени файла (без вложенной папки)
     * Например: math.vx в node_modules/math.vx
     */
    findDirectModule(moduleName, currentPath) {
        // Проверяем каждый путь node_modules для прямого файла
        for (const basePath of this.nodeModulesPaths) {
            // Пробуем расширение .vx
            const vxPath = join(basePath, moduleName + '.vx');
            if (existsSync(vxPath)) {
                return vxPath;
            }

            // Пробуем .js
            const jsPath = join(basePath, moduleName + '.js');
            if (existsSync(jsPath)) {
                return jsPath;
            }

            // Пробуем index.vx (node_modules/name/index.vx)
            const indexPath = join(basePath, moduleName, 'index.vx');
            if (existsSync(indexPath)) {
                return indexPath;
            }
        }

        return null;
    }

    /**
     * Поиск пакета в node_modules
     */
    findPackage(packageInfo, currentPath) {
        // Сначала пробуем найти прямой файл (node_modules/math.vx)
        const directModule = this.findDirectModule(packageInfo.name, currentPath);
        if (directModule) {
            return { path: directModule, isDirect: true };
        }

        // Пробуем локальные node_modules
        for (const basePath of this.nodeModulesPaths) {
            const packagePath = join(basePath, packageInfo.fullName);

            if (existsSync(packagePath)) {
                // Проверяем, это файл или директория
                if (existsSync(join(packagePath, 'package.json'))) {
                    return { path: packagePath, isDirect: false }; // Пакет с package.json
                }
                if (existsSync(join(packagePath, 'index.vx'))) {
                    return { path: packagePath, isDirect: false }; // Пакет с index.vx
                }
            }

            // Для scoped packages пробуем по-другому
            if (packageInfo.scope) {
                const scopedPath = join(basePath, '@' + packageInfo.scope, packageInfo.name);
                if (existsSync(scopedPath)) {
                    return { path: scopedPath, isDirect: false };
                }
            }
        }

        return null;
    }
    
    /**
     * Получение главного файла пакета из package.json
     */
    getPackageMain(packagePath) {
        // Если это не директория, а файл - возвращаем как есть
        if (!existsSync(join(packagePath, 'package.json')) && !existsSync(join(packagePath, 'index.vx'))) {
            if (existsSync(packagePath)) {
                const stat = require('fs').statSync(packagePath);
                if (stat.isFile()) {
                    return packagePath;
                }
            }
        // Пробуем найти файл с расширением .vx в этой директории
        const pkgName = basename(packagePath);
        const vxFile = join(packagePath, pkgName + '.vx');
        if (existsSync(vxFile)) {
            return vxFile;
        }
        return packagePath;
        }

        const packageJsonPath = join(packagePath, 'package.json');

        if (!existsSync(packageJsonPath)) {
            // Нет package.json, пробуем index.vx
            if (existsSync(join(packagePath, 'index.vx'))) {
                return join(packagePath, 'index.vx');
            }
            throw new Error(`В пакете отсутствует package.json: ${packagePath}`);
        }

        try {
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

            // Получаем main файл
            let mainFile = packageJson.main || 'index.js';

            // Пробуем .vx версию main файла
            const vxMain = mainFile.replace(/\.js$/, '.vx');
            if (existsSync(join(packagePath, vxMain))) {
                return join(packagePath, vxMain);
            }

            // Пробуем index.vx
            if (existsSync(join(packagePath, 'index.vx'))) {
                return join(packagePath, 'index.vx');
            }

            return join(packagePath, mainFile);
        } catch (error) {
            const errorMessage = error.toString ? error.toString() : String(error) || 'Неизвестная ошибка';
            throw new Error(`Ошибка чтения package.json: ${errorMessage}`);
        }
    }
    
    /**
     * Разрешение пути модуля (файл или пакет)
     */
    resolveModulePath(modulePath, currentPath) {
        // Проверяем, является ли это именем пакета
        if (this.isPackageName(modulePath)) {
            return this.resolvePackagePath(modulePath, currentPath);
        }

        // Иначе это локальный файл
        return this.resolveFilePath(modulePath, currentPath);
    }
    
    /**
     * Разрешение пути к файлу модуля
     */
    resolveFilePath(modulePath, currentPath) {
        // Извлекаем директорию из текущего пути
        let currentDir = dirname(currentPath);
        
        // Если путь не абсолютный, используем текущую рабочую директорию как базу
        if (!isAbsolute(currentPath)) {
            currentDir = process.cwd();
        }
        
        // Если передан не абсолютный путь, преобразуем относительно директории текущего файла
        if (!isAbsolute(modulePath)) {
            modulePath = join(currentDir, modulePath);
        }
        
        // Проверка расширений
        const extensions = ['.vx', '.js', '.vladx', '.json'];
        
        for (const ext of extensions) {
            if (existsSync(modulePath + ext)) {
                return modulePath + ext;
            }
        }
        
        // Проверка файла без расширения
        if (existsSync(modulePath)) {
            return modulePath;
        }
        
        throw new Error(`Модуль "${modulePath}" не найден`);
    }
    
    /**
     * Разрешение пути к пакету
     */
    resolvePackagePath(packagePath, currentPath) {
        const packageInfo = this.parsePackageName(packagePath);

        // Ищем пакет в node_modules
        const foundResult = this.findPackage(packageInfo, currentPath);

        if (!foundResult) {
            throw new Error(`Пакет "${packageInfo.fullName}" не найден. Установите его с помощью: vladpm установить ${packageInfo.fullName}`);
        }

        // Если нашли прямой файл (node_modules/math.vx), возвращаем его сразу
        if (foundResult.isDirect) {
            return foundResult.path;
        }

        // Иначе это директория пакета, получаем главный файл
        return this.getPackageMain(foundResult.path);
    }
    
    /**
     * Загрузка модуля
     */
    async loadModule(modulePath, currentPath) {

        // Разрешаем путь модуля
        const resolvedPath = this.resolveModulePath(modulePath, currentPath);

        // Проверка кэша
        if (this.moduleCache.has(resolvedPath)) {
            return this.moduleCache.get(resolvedPath);
        }

        // Проверка циклической зависимости
        if (this.loadedModules.has(resolvedPath)) {
            return this.loadedModules.get(resolvedPath);
        }

        // Чтение файла
        if (!existsSync(resolvedPath)) {
            throw new Error(`Файл модуля не найден: ${resolvedPath}`);
        }

        const source = readFileSync(resolvedPath, 'utf-8');
        const moduleDir = dirname(resolvedPath);

        // Создание нового окружения для модуля
        const moduleEnv = this.interpreter.globalEnv.child(`<module:${resolvedPath}>`);
        moduleEnv.exports = {};

        // Парсинг и выполнение с новым окружением
        try {
            // Создаём временный интерпретатор для модуля
                        // Создаём временный интерпретатор для модуля (с абсолютными путями)
            

            const lexer = new Lexer(source, resolvedPath);
            const tokens = lexer.tokenize();
            const parser = new Parser(tokens);
            const ast = parser.parse();

            // Временно меняем окружение
            const oldEnv = this.interpreter.currentEnv;
            this.interpreter.currentEnv = moduleEnv;

            // Добавляем путь node_modules для вложенных импортов
            const oldPaths = this.nodeModulesPaths;
            this.nodeModulesPaths = [moduleDir, ...this.nodeModulesPaths];

            // Выполняем модуль
                                // Выполняем модуль
                                        // Регистрируем встроенные функции в окружении модуля
                                                            this.interpreter.registerBuiltins();
                    try {
                        await this.interpreter.interpret(ast, {
                            filename: resolvedPath,
                            environment: moduleEnv
                        });
                        
                    } catch (moduleError) {
                        console.error('[ModuleSystem] ОШИБКА ВЫПОЛНЕНИЯ МОДУЛЯ:', moduleError);
                        console.error('[ModuleSystem] Стек:', moduleError.stack);
                        throw moduleError;
                    }
            // Восстанавливаем пути
            this.nodeModulesPaths = oldPaths;

            // Восстанавливаем окружение
            this.interpreter.currentEnv = oldEnv;

            // Извлекаем экспорты
            const moduleExports = moduleEnv.exports && Object.keys(moduleEnv.exports).length > 0
                ? moduleEnv.exports
                : this.extractAllFromEnv(moduleEnv);

            // Кэширование модуля
            this.moduleCache.set(resolvedPath, moduleExports);
            this.loadedModules.set(resolvedPath, moduleExports);

            return moduleExports;
        } catch (error) {
            let errorMessage = error.toString ? error.toString() : String(error);
            if (!errorMessage) {
                errorMessage = `Ошибка типа: ${error.constructor.name}`;
                if (error.stack) {
                    errorMessage += `\nСтек вызовов: ${error.stack}`;
                } else {
                    errorMessage += ' (Стек вызовов недоступен)';
                }
            }
            throw new Error(`Ошибка загрузки модуля ${resolvedPath}: ${errorMessage}`);
        }
    }
    
    /**
     * Извлечение всех значений из окружения
     */
    extractAllFromEnv(env) {
        const exports = {};

        // Добавляем экспорты, если они есть
        if (env.exports) {
            Object.assign(exports, env.exports);
        }

        // Добавляем все переменные, если их нет в экспортах
        for (const [key, value] of env.variables) {
            if (!(key in exports)) {
                exports[key] = value;
            }
        }

        return exports;
    }
    
    /**
     * Очистка кэша модулей
     */
    clearCache() {
        this.loadedModules.clear();
        this.moduleCache.clear();
    }
}

export default ModuleSystem;
