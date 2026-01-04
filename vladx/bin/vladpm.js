#!/usr/bin/env node

/**
 * VladX Package Manager (vladpm) — Менеджер пакетов
 * Мощный менеджер пакетов для языка VladX
 */
import { spawn } from 'child_process';

import {
    readFileSync, writeFileSync, existsSync, mkdirSync,
    rmSync, copyFileSync, readdirSync, lstatSync, createWriteStream
} from 'fs';
import {
    dirname, join, extname, basename, resolve,
    relative, isAbsolute
} from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync, spawnSync } from 'child_process';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import readline from 'readline';
import { extract } from 'tar';
import { createGzip } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Версия
const VERSION = '1.0.0';

// URL реестра по умолчанию
const DEFAULT_REGISTRY = 'http://185.105.108.233:4873';

// Кэш пакетов
const packageCache = new Map();

/**
 * Получение URL реестра
 */
function getRegistry() {
    return process.env.VLADX_REGISTRY || DEFAULT_REGISTRY;
}

/**
 * Вывод справки
 */
function printHelp() {
    console.log(`
VladX Package Manager (vladpm) — Менеджер пакетов

Использование:
  vladpm [команда] [опции]

Команды:
  установить [пакет]     Установить пакет(ы)
  удалить [пакет]        Удалить пакет
  обновить [пакет]       Обновить пакет(ы)
  список                 Список установленных пакетов
  поиск [запрос]         Поиск пакетов
  информация [пакет]     Информация о пакете
  опубликовать           Опубликовать пакет
  отозвать [версия]      Отозвать версию пакета
  инициализировать       Создать vladx.json
  обновить               Обновить vladpm

Опции:
  -h, --help             Показать справку
  -v, --version          Показать версию
  -g, --global           Глобальная установка
  -D, --dev              Установить как dev-зависимость
  -S, --save             Сохранить в dependencies (по умолчанию)
  --save-exact           Точная версия без ^
  --prefer-offline       Предпочитать кэш
  --registry <url>       Использовать другой registry

Примеры:
  vladpm установить vx           Установить модуль vx
  vladpm установить vx@1.0.0     Установить конкретную версию
  vladpm установить -g vx        Глобальная установка
  vladpm удалить vx              Удалить пакет
  vladpm обновить                Обновить все пакеты
  vladpm поиск vx                Поиск пакетов

Реестр:
  По умолчанию: ${DEFAULT_REGISTRY}
  Можно изменить через переменную VLADX_REGISTRY или --registry

Документация: https://vladx.dev/docs/packages
`);
}

/**
 * Вывод версии
 */
function printVersion() {
    console.log(`VladX Package Manager версия ${VERSION}`);
    console.log(`Node.js версия: ${process.version}`);
}

/**
 * Получение пути к проекту
 */
function getProjectPath() {
    let currentDir = process.cwd();
    const rootDir = process.env.HOME || 'C:\\Users\\' + process.env.USERNAME;

    while (currentDir !== rootDir && currentDir !== '/' && currentDir !== 'C:\\') {
        const pkgPath = join(currentDir, 'vladx.json');
        if (existsSync(pkgPath)) {
            return currentDir;
        }
        currentDir = dirname(currentDir);
    }

    return process.cwd();
}

/**
 * Чтение vladx.json
 */
function readPackageJson(path = null) {
    const projectPath = path || getProjectPath();
    const pkgPath = join(projectPath, 'vladx.json');

    if (existsSync(pkgPath)) {
        return JSON.parse(readFileSync(pkgPath, 'utf-8'));
    }

    return {
        name: 'unnamed-project',
        version: '1.0.0',
        description: '',
        main: 'index.vx',
        dependencies: {},
        devDependencies: {},
        scripts: {}
    };
}

/**
 * Запись vladx.json
 */
function writePackageJson(pkg, path = null) {
    const projectPath = path || getProjectPath();
    const pkgPath = join(projectPath, 'vladx.json');
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Получение пути node_modules
 */
function getNodeModulesPath(path = null) {
    const projectPath = path || getProjectPath();
    return join(projectPath, 'node_modules');
}

/**
 * Получение пути к глобальным модулям
 */
function getGlobalNodeModulesPath() {
    const home = process.env.HOME || process.env.USERPROFILE;
    return join(home, '.vladx', 'global_modules');
}

/**
 * Нормализация URL tarball для использования правильного реестра
 * Заменяет адрес в URL на baseURL реестра
 */
function normalizeTarballUrl(tarballUrl, packageName) {
    const registry = getRegistry();

    // Извлекаем base URL из registry (убираем trailing slash)
    const registryBaseUrl = registry.replace(/\/$/, '');

    // Паттерны для определения локальных URL
    const localPatterns = [
        /^http:\/\/localhost:\d+\//,
        /^http:\/\/127\.0\.0\.1:\d+\//,
        /^http:\/\/[^\/]+:\d+\//,
    ];

    // Проверяем, нужно ли нормализовать URL
    const needsNormalization = localPatterns.some(pattern => pattern.test(tarballUrl));

    if (needsNormalization) {
        // Извлекаем путь и имя файла из URL
        const urlMatch = tarballUrl.match(/^(https?:\/\/[^/]+)(.+)$/);
        if (urlMatch) {
            const originalBase = urlMatch[1];
            const path = urlMatch[2];
            // Формируем новый URL с правильным base
            return `${registryBaseUrl}${path}`;
        }
    }

    return tarballUrl;
}

/**
 * Разбор имени пакета с версией
 */
function parsePackageName(name, defaultVersion = 'latest') {
    // Поддержка формата: package@version, @scope/package@version, package
    if (name.startsWith('@')) {
        // Это scoped package: @scope/package или @scope/package@version
        const withoutAt = name.substring(1);
        const slashIndex = withoutAt.indexOf('/');
        if (slashIndex === -1) {
            // Некорректный формат scoped package
            return { name, version: defaultVersion };
        }

        const scope = '@' + withoutAt.substring(0, slashIndex);
        const rest = withoutAt.substring(slashIndex + 1);

        // Проверяем, есть ли версия в части после слэша
        const versionSeparatorIndex = rest.lastIndexOf('@');
        if (versionSeparatorIndex !== -1) {
            const pkgName = rest.substring(0, versionSeparatorIndex);
            const version = rest.substring(versionSeparatorIndex + 1);
            return {
                name: `${scope}/${pkgName}`,
                version: version || defaultVersion
            };
        } else {
            // Нет версии
            return {
                name: name,
                version: defaultVersion
            };
        }
    } else {
        // Обычный пакет: package@version или package
        const versionSeparatorIndex = name.lastIndexOf('@');
        if (versionSeparatorIndex !== -1) {
            const pkgName = name.substring(0, versionSeparatorIndex);
            const version = name.substring(versionSeparatorIndex + 1);
            return {
                name: pkgName,
                version: version || defaultVersion
            };
        } else {
            // Нет версии
            return {
                name: name,
                version: defaultVersion
            };
        }
    }
}

/**
 * Получение информации о пакете из реестра
 */
async function fetchPackageInfo(name, version = 'latest') {
    const registry = getRegistry();
    const url = `${registry}/${name}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        // Если запрошена конкретная версия, сначала ищем её в versions
        if (version !== 'latest') {
            if (data.versions && data.versions[version]) {
                // Нашли конкретную версию
                return {
                    ...data.versions[version],
                    'dist-tags': data['dist-tags'] || {}
                };
            } else if (data['dist-tags'] && data['dist-tags'][version]) {
                // Если не нашли в versions, но есть в dist-tags (например, 'latest')
                const versionName = data['dist-tags'][version];
                const versionData = data.versions[versionName];
                if (versionData) {
                    return {
                        ...data['dist-tags'][version],
                        ...versionData,
                        'dist-tags': data['dist-tags']
                    };
                }
            }
        }

        // Возвращаем latest по умолчанию
        const latestVersion = data['dist-tags']?.latest || Object.keys(data.versions || {})[0];
        if (latestVersion && data.versions && data.versions[latestVersion]) {
            return {
                ...data.versions[latestVersion],
                'dist-tags': data['dist-tags'] || {}
            };
        }

        return null;
    } catch (error) {
        console.error(`Ошибка получения информации о пакете ${name}: ${error.message}`);
        return null;
    }
}

/**
 * Получение ссылки на скачивание пакета
 */
async function getPackageTarball(name, version = 'latest') {
    const pkg = await fetchPackageInfo(name, version);
    if (!pkg || !pkg.dist || !pkg.dist.tarball) {
        return null;
    }
    return pkg.dist.tarball;
}

/**
 * Скачивание и распаковка пакета
 */
async function downloadAndExtractPackage(packageName, options = {}) {
    const { version = 'latest', global = false } = options;

    const registry = getRegistry();
    const packageInfo = parsePackageName(packageName, version);

    console.log(`📦 Загрузка ${packageInfo.name}@${packageInfo.version}...`);

    try {
        // Получаем информацию о пакете
        const pkgInfo = await fetchPackageInfo(packageInfo.name, packageInfo.version);
        if (!pkgInfo) {
            console.error(`❌ Пакет ${packageInfo.name} не найден в реестре`);
            return false;
        }

        // Нормализуем URL tarball для использования правильного реестра
        let tarballUrl = pkgInfo.dist.tarball;
        console.log(`   Оригинальная ссылка: ${tarballUrl}`);

        // Заменяем адрес с портом на baseURL реестра
        tarballUrl = normalizeTarballUrl(tarballUrl, packageInfo.name);
        console.log(`   Используемая ссылка: ${tarballUrl}`);

        // Определяем путь установки
        const isGlobal = global;
        const nodeModulesPath = isGlobal ? getGlobalNodeModulesPath() : getNodeModulesPath();

        // Для scoped пакетов создаем правильную структуру директорий
        let packagePath;
        if (packageInfo.name.startsWith('@')) {
            // Для scoped пакетов (@scope/name) создаем node_modules/@scope/name/
            const [scope, pkgName] = packageInfo.name.split('/');
            const scopeDir = join(nodeModulesPath, scope);
            if (!existsSync(scopeDir)) {
                mkdirSync(scopeDir, { recursive: true });
            }
            packagePath = join(scopeDir, pkgName);
        } else {
            // Для обычных пакетов создаем node_modules/name/
            packagePath = join(nodeModulesPath, packageInfo.name);
        }

        // Создаём директорию node_modules если нужно
        if (!existsSync(nodeModulesPath)) {
            mkdirSync(nodeModulesPath, { recursive: true });
        }

        // Удаляем старую версию если есть
        if (existsSync(packagePath)) {
            rmSync(packagePath, { recursive: true, force: true });
        }

        // Скачиваем tarball
        console.log(`   Скачивание...`);
        const tempTarballPath = join(nodeModulesPath, `${packageInfo.name.replace('/', '-').replace('@', '')}-${packageInfo.version}.tgz`);

        const response = await fetch(tarballUrl);
        if (!response.ok) {
            throw new Error(`Ошибка скачивания: ${response.status}`);
        }

        const fileStream = createWriteStream(tempTarballPath);
        await pipeline(response.body, fileStream);

        console.log(`   Распаковка...`);

        // Распаковываем tarball
        await extractTarball(tempTarballPath, packagePath);

        // Удаляем временный tarball
        rmSync(tempTarballPath, { force: true });

        // Устанавливаем зависимости пакета
        if (pkgInfo.dependencies) {
            console.log(`   Установка зависимостей...`);
            for (const [depName, depVersion] of Object.entries(pkgInfo.dependencies)) {
                // Очищаем версию от диапазонов
                const cleanVersion = depVersion.replace(/[\^~<>=]/g, '');
                await downloadAndExtractPackage(depName, { version: cleanVersion, global: isGlobal });
            }
        }

        // Обновляем vladx.json
        if (!isGlobal) {
            const currentPkg = readPackageJson();
            currentPkg.dependencies[packageInfo.name] = '^' + pkgInfo.version;
            writePackageJson(currentPkg);
        }

        console.log(`✅ ${packageInfo.name}@${pkgInfo.version} установлен`);
        return true;

    } catch (error) {
        console.error(`❌ Ошибка установки: ${error.message}`);
        return false;
    }
}

/**
 * Распаковка tarball архива
 */
async function extractTarball(tarballPath, destPath) {
    // Создаём директорию назначения
    mkdirSync(destPath, { recursive: true });

    // Распаковываем архив
    await extract({
        file: tarballPath,
        cwd: destPath,
        strip: 1 // Убираем корневую директорию из архива
    });
}

/**
 * Установка пакета (основная функция)
 */
async function installPackage(packageName, options = {}) {
    const { version = 'latest', global = false, dev = false, saveExact = false } = options;

    const projectPath = global ? null : getProjectPath();
    const nodeModulesPath = getNodeModulesPath(projectPath);

    // Создание node_modules если нет
    if (!existsSync(nodeModulesPath)) {
        mkdirSync(nodeModulesPath, { recursive: true });
    }

    // Разбор имени пакета и версии
    const packageInfo = parsePackageName(packageName, version);

    console.log(`📦 Установка ${packageInfo.name}@${packageInfo.version}...`);

    try {
        // Загрузка и установка пакета
        const success = await downloadAndExtractPackage(packageName, { version: packageInfo.version, global });

        if (!success) {
            return false;
        }

        // Сохранение в vladx.json
        if (!global) {
            const currentPkg = readPackageJson();
            const depsKey = dev ? 'devDependencies' : 'dependencies';
            const versionPrefix = saveExact ? '' : '^';
            currentPkg[depsKey][packageInfo.name] = versionPrefix + packageInfo.version;
            writePackageJson(currentPkg);
        }

        console.log(`✅ ${packageInfo.name}@${packageInfo.version} установлен`);
        return true;

    } catch (error) {
        console.error(`❌ Ошибка установки: ${error.message}`);
        return false;
    }
}

/**
 * Удаление пакета
 */
async function removePackage(packageName, options = {}) {
    const { global = false } = options;

    const nodeModulesPath = global ? getGlobalNodeModulesPath() : getNodeModulesPath();

    // Для scoped пакетов удаляем из правильной директории
    let pkgPath;
    if (packageName.startsWith('@')) {
        // Для scoped пакетов (@scope/name) удаляем из node_modules/@scope/name/
        const [scope, pkgName] = packageName.split('/');
        const scopeDir = join(nodeModulesPath, scope);
        pkgPath = join(scopeDir, pkgName);
    } else {
        // Для обычных пакетов удаляем из node_modules/name/
        pkgPath = join(nodeModulesPath, packageName);
    }

    if (!existsSync(pkgPath)) {
        console.log(`Пакет ${packageName} не установлен`);
        return false;
    }

    rmSync(pkgPath, { recursive: true, force: true });

    // Удаляем директорию scope, если она пуста (для scoped пакетов)
    if (packageName.startsWith('@')) {
        const [scope, pkgName] = packageName.split('/');
        const scopeDir = join(nodeModulesPath, scope);
        if (existsSync(scopeDir)) {
            const files = readdirSync(scopeDir);
            if (files.length === 0) {
                rmSync(scopeDir, { recursive: true, force: true });
            }
        }
    }

    // Удаление из vladx.json
    if (!global) {
        const pkg = readPackageJson();
        delete pkg.dependencies[packageName];
        delete pkg.devDependencies[packageName];
        writePackageJson(pkg);
    }

    console.log(`✅ ${packageName} удалён`);
    return true;
}

/**
 * Список установленных пакетов
 */
function listPackages(options = {}) {
    const { global = false } = options;

    const nodeModulesPath = global ? getGlobalNodeModulesPath() : getNodeModulesPath();

    if (!existsSync(nodeModulesPath)) {
        console.log('Нет установленных пакетов');
        return;
    }

    let packages = [];

    // Считываем все обычные пакеты
    const items = readdirSync(nodeModulesPath);
    for (const item of items) {
        if (item.startsWith('.')) continue;

        if (item.startsWith('@')) {
            // Это scoped директория, проверяем пакеты внутри
            const scopePath = join(nodeModulesPath, item);
            if (lstatSync(scopePath).isDirectory()) {
                const scopeItems = readdirSync(scopePath);
                for (const pkgName of scopeItems) {
                    const pkgPath = join(scopePath, pkgName, 'package.json');
                    if (existsSync(pkgPath)) {
                        packages.push(`${item}/${pkgName}`);
                    }
                }
            }
        } else {
            // Обычный пакет
            const pkgPath = join(nodeModulesPath, item, 'package.json');
            if (existsSync(pkgPath)) {
                packages.push(item);
            }
        }
    }

    console.log('\nУстановленные пакеты:\n');

    if (packages.length === 0) {
        console.log('  Нет пакетов');
    }

    for (const name of packages) {
        const parts = name.split('/');
        let pkgPath;
        if (parts.length === 2 && name.startsWith('@')) {
            // Scoped package
            pkgPath = join(nodeModulesPath, parts[0], parts[1], 'package.json');
        } else {
            // Regular package
            pkgPath = join(nodeModulesPath, name, 'package.json');
        }

        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        console.log(`  ${name}@${pkg.version}`);
    }

    console.log('');
}

/**
 * Поиск пакета
 */
async function searchPackage(query) {
    console.log(`🔍 Поиск "${query}"...`);

    try {
        const registry = getRegistry();
        // Получаем список всех пакетов и фильтруем
        const response = await fetch(`${registry}/-/all`);
        if (!response.ok) {
            throw new Error('Ошибка запроса');
        }

        const data = await response.json();
        const packages = data.objects || [];

        const results = packages.filter(pkg =>
            pkg.name.toLowerCase().includes(query.toLowerCase()) ||
            (pkg.description && pkg.description.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, 10);

        if (results.length === 0) {
            console.log('Пакеты не найдены');
            return;
        }

        console.log('\nРезультаты поиска:\n');

        for (const result of results) {
            const pkg = result.package || result;
            console.log(`  ${pkg.name}@${pkg.version || 'latest'}`);
            console.log(`    ${pkg.description || 'Без описания'}`);
            console.log('');
        }

    } catch (error) {
        console.log(`Поиск временно недоступен: ${error.message}`);
    }
}

/**
 * Информация о пакете
 */
async function packageInfo(packageName) {
    const packageInfo = parsePackageName(packageName);

    console.log(`📦 Информация о ${packageInfo.name}@${packageInfo.version}\n`);

    const pkg = await fetchPackageInfo(packageInfo.name, packageInfo.version);

    if (!pkg) {
        console.log('Пакет не найден');
        return;
    }

    console.log(`  Название: ${pkg.name}`);
    console.log(`  Версия: ${pkg.version}`);
    console.log(`  Описание: ${pkg.description || 'Нет описания'}`);
    console.log(`  Главный файл: ${pkg.main || 'index.js'}`);

    if (pkg.keywords) {
        console.log(`  Ключевые слова: ${pkg.keywords.join(', ')}`);
    }

    if (pkg.license) {
        console.log(`  Лицензия: ${pkg.license}`);
    }

    if (pkg.author) {
        console.log(`  Автор: ${typeof pkg.author === 'string' ? pkg.author : pkg.author.name}`);
    }

    if (pkg.dist && pkg.dist.tarball) {
        console.log(`  Tarball: ${pkg.dist.tarball}`);
    }

    console.log('\n  Зависимости:');
    if (pkg.dependencies) {
        for (const [name, version] of Object.entries(pkg.dependencies)) {
            console.log(`    ${name}@${version}`);
        }
    } else {
        console.log('    Нет');
    }

    console.log('');
}

/**
 * Инициализация проекта
 */
async function initProject(options = {}) {
    const projectPath = process.cwd();
    const pkgPath = join(projectPath, 'vladx.json');

    if (existsSync(pkgPath)) {
        console.log('vladx.json уже существует');
        return;
    }

    // Попробуем получить username для создания scoped пакета
    const username = await getUsernameFromToken();
    let packageName = basename(projectPath);

    if (username) {
        packageName = `@${username}/${packageName}`;
        console.log(`ℹ️  Используется scoped имя пакета: ${packageName}`);
    }

    const pkg = {
        name: packageName,
        version: '1.0.0',
        description: '',
        main: 'index.vx',
        bin: {},
        keywords: [],
        author: username || '',
        license: 'MIT',
        dependencies: {},
        devDependencies: {},
        scripts: {
            start: 'vlad index.vx',
            test: 'vlad test.vx'
        }
    };

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('✅ vladx.json создан');
}

/**
 * Обновление пакетов
 */
async function updatePackages(options = {}) {
    const { global = false } = options;

    const projectPath = global ? null : getProjectPath();
    const pkg = readPackageJson(projectPath);

    console.log('🔄 Обновление пакетов...\n');

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    let updated = 0;

    for (const [name, currentVersion] of Object.entries(allDeps)) {
        const cleanVersion = currentVersion.replace(/^\^/, '');

        // Проверка последней версии
        const latestInfo = await fetchPackageInfo(name, 'latest');
        if (latestInfo && latestInfo.version !== cleanVersion) {
            console.log(`  ${name}: ${cleanVersion} → ${latestInfo.version}`);
            await installPackage(`${name}@${latestInfo.version}`, { global });
            updated++;
        }
    }

    console.log(`\n✅ Обновлено ${updated} пакетов`);
}

/**
 * Подготовка файлов пакета
 */
async function preparePackageFiles(sourceDir, destDir) {
    const ignorePatterns = [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.vladpm-publish',
        '.DS_Store',
        'Thumbs.db'
    ];
    
    // Копируем package.json
    const pkg = readPackageJson(sourceDir);
    writeFileSync(join(destDir, 'package.json'), JSON.stringify(pkg, null, 2));
    
    // Копируем остальные файлы
    const files = readdirSync(sourceDir);
    
    for (const file of files) {
        const sourcePath = join(sourceDir, file);
        const destPath = join(destDir, file);
        
        if (ignorePatterns.some(pattern => file.includes(pattern))) {
            continue;
        }
        
        if (lstatSync(sourcePath).isDirectory()) {
            mkdirSync(destPath, { recursive: true });
            await preparePackageFiles(sourcePath, destPath);
        } else {
            copyFileSync(sourcePath, destPath);
        }
    }
}

/**
 * Получение токена авторизации
 */
async function getAuthToken() {
    try {
        const homeDir = process.env.HOME || process.env.USERPROFILE;
        const npmrcPath = join(homeDir, '.npmrc');

        if (existsSync(npmrcPath)) {
            const npmrcContent = readFileSync(npmrcPath, 'utf-8');
            const lines = npmrcContent.split('\n');

            // Ищем токен для текущего реестра
            const registry = getRegistry().replace(/^https?:\/\//, '');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('//')) {
                    const match = line.match(/^\/\/([^/]+)\/:_authToken=(.+)$/);
                    if (match) {
                        const reg = match[1];
                        const token = match[2];

                        // Проверяем совпадение реестра
                        if (reg === registry || reg.includes(registry) || registry.includes(reg)) {
                            return token;
                        }
                    }
                }
            }
        }

        return null;
    } catch (error) {
        console.warn('Не удалось получить токен:', error.message);
        return null;
    }
}

/**
 * Извлечение username из токена (предполагаем, что токен содержит информацию о пользователе)
 */
async function getUsernameFromToken() {
    try {
        const token = await getAuthToken();
        if (!token) {
            return null;
        }

        // Пытаемся извлечь username из токена (если это JWT)
        if (token.includes('.')) {
            // Это JWT токен, декодируем payload
            try {
                const payload = token.split('.')[1];
                const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
                return decoded.username || decoded.name || decoded.sub || null;
            } catch (e) {
                // Если не JWT, ищем в .npmrc файле
                const homeDir = process.env.HOME || process.env.USERPROFILE;
                const npmrcPath = join(homeDir, '.npmrc');

                if (existsSync(npmrcPath)) {
                    const npmrcContent = readFileSync(npmrcPath, 'utf-8');
                    const lines = npmrcContent.split('\n');

                    // Ищем строку с именем пользователя
                    for (const line of lines) {
                        if (line.includes('_authToken=' + token)) {
                            // Пытаемся найти username в других строках
                            for (const otherLine of lines) {
                                if (otherLine.includes('username=')) {
                                    return otherLine.split('=')[1].trim();
                                }
                            }
                        }
                    }
                }
            }
        }

        return null;
    } catch (error) {
        console.warn('Не удалось получить username из токена:', error.message);
        return null;
    }
}

/**
 * Логин в реестр
 */
async function loginToRegistry() {
    const registry = getRegistry();
    const readlineInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log(`\n🔐 Логин в реестр: ${registry}`);
    console.log('   (если нет аккаунта, он будет создан автоматически)');
    
    const username = await new Promise(resolve => {
        readlineInterface.question('Username: ', resolve);
    });
    
    const password = await new Promise(resolve => {
        readlineInterface.question('Password: ', { hideEchoBack: true }, resolve);
    });
    
    const email = await new Promise(resolve => {
        readlineInterface.question('Email (опционально): ', resolve);
    });
    
    readlineInterface.close();
    
    try {
        const response = await fetch(`${registry}/-/user/org.couchdb.user:${username}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: username, password, email })
        });
        
        const data = await response.json();
        
        if (data.token) {
            // Сохраняем токен в ~/.npmrc
            const homeDir = process.env.HOME || process.env.USERPROFILE;
            const npmrcPath = join(homeDir, '.npmrc');
            const registryUrl = registry.replace(/^https?:\/\//, '');
            
            let npmrcContent = '';
            if (existsSync(npmrcPath)) {
                npmrcContent = readFileSync(npmrcPath, 'utf-8');
            }
            
            // Удаляем старый токен для этого реестра
            const lines = npmrcContent.split('\n').filter(line => {
                return !line.includes(`//${registryUrl}/:_authToken=`);
            });
            
            // Добавляем новый токен
            lines.push(`//${registryUrl}/:_authToken=${data.token}`);
            
            writeFileSync(npmrcPath, lines.join('\n'));
            
            console.log(`✅ Успешный вход! Токен сохранён в ~/.npmrc`);
            console.log(`   Теперь можно публиковать пакеты.`);
            return true;
        }
        
        throw new Error('Не удалось получить токен');
    } catch (error) {
        console.error(`❌ Ошибка входа: ${error.message}`);
        return false;
    }
}

/**
 * Копирование файлов проекта для публикации
 */
function copyProjectFiles(source, dest) {
    const entries = readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = join(source, entry.name);
        const destPath = join(dest, entry.name);

        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== 'build' && entry.name !== '.vladpm-publish') {
                mkdirSync(destPath, { recursive: true });
                copyProjectFiles(sourcePath, destPath);
            }
        } else if (entry.isFile()) {
            copyFileSync(sourcePath, destPath);
        }
    }

    // Копируем package.json
    const pkgJson = readPackageJson(source);
    writeFileSync(join(dest, 'package.json'), JSON.stringify(pkgJson, null, 2));
}

/**
 * Публикация пакета
 */
async function publishPackage(options = {}) {
    const projectPath = getProjectPath();
    const pkg = readPackageJson(projectPath);

    console.log(`📤 Публикация ${pkg.name}@${pkg.version}...`);

    // Проверка необходимых полей
    if (!pkg.name || !pkg.version) {
        console.error('❌ Отсутствуют обязательные поля: name, version');
        return false;
    }

    // Проверяем, имеет ли пакет scope (@username/package)
    let packageName = pkg.name;
    if (!packageName.startsWith('@')) {
        // Если пакет не имеет scope, добавляем scope пользователя
        const username = await getUsernameFromToken();
        if (username) {
            packageName = `@${username}/${pkg.name}`;
            console.log(`   Автоматически добавлен scope: ${packageName}`);
        }
    }

    try {
        // 1. Создание tarball (используем стандартный npm pack)
        console.log('   Создание tarball...');

        // Создаём временную директорию для сборки пакета
        const tempDir = join(projectPath, '.vladpm-publish');
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
        mkdirSync(tempDir, { recursive: true });

        // Копируем все нужные файлы (исключая ненужные)
        await preparePackageFiles(projectPath, tempDir);

        // Создаём tarball с помощью npm pack в скопированной директории
        console.log('   Запуск npm pack...');

        // Изменяем текущую директорию на временную
        const originalCwd = process.cwd();
        process.chdir(tempDir);

        // Используем npm pack для создания tarball
        const tarballName = `${packageName.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
        execSync(`npm pack`, { stdio: 'inherit' });

        // Возвращаемся обратно
        process.chdir(originalCwd);

        // Ищем созданный tarball
        const tarballPath = join(tempDir, tarballName);
        if (!existsSync(tarballPath)) {
            // Ищем любой tgz файл
            const files = readdirSync(tempDir).filter(f => f.endsWith('.tgz'));
            if (files.length === 0) {
                throw new Error('Tarball не создан');
            }
        }

        console.log(`   Tarball создан: ${tarballPath}`);

        // 2. Читаем tarball как base64
        console.log('   Подготовка данных...');
        const tarballBuffer = readFileSync(tarballPath);
        const tarballBase64 = tarballBuffer.toString('base64');

        // 3. Создаём правильный формат для публикации
        const packageData = {
            _id: packageName,
            name: packageName,
            description: pkg.description || '',
            'dist-tags': {
                latest: pkg.version
            },
            versions: {
                [pkg.version]: {
                    ...pkg,
                    _id: `${packageName}@${pkg.version}`,
                    name: packageName,
                    version: pkg.version,
                    dist: {
                        shasum: crypto.createHash('sha1').update(tarballBuffer).digest('hex'),
                        integrity: `sha512-${crypto.createHash('sha512').update(tarballBuffer).digest('base64')}`,
                        tarball: `http://${getRegistry().replace(/^https?:\/\//, '')}/${packageName}/-/${tarballName}`
                    }
                }
            },
            _attachments: {
                [tarballName]: {
                    content_type: 'application/octet-stream',
                    data: tarballBase64,
                    length: tarballBuffer.length
                }
            }
        };

        // 4. Получаем токен
        console.log('   Аутентификация...');
        const token = await getAuthToken();
        if (!token) {
            console.error('❌ Требуется аутентификация. Сначала выполните:');
            console.error('   npm adduser --registry=' + getRegistry());
            console.error('   или установите токен в ~/.npmrc');
            return false;
        }

        // 5. Публикуем в реестр
        console.log('   Отправка на сервер...');
        const registry = getRegistry();
        const response = await fetch(`${registry}/${packageName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(packageData)
        });

        const responseText = await response.text();
        console.log(`   Ответ сервера: ${response.status} ${response.statusText}`);

        if (response.status !== 201 && response.status !== 200) {
            console.error(`   Тело ответа: ${responseText}`);
            throw new Error(`Ошибка публикации: ${response.status}`);
        }

        // 6. Очищаем временные файлы
        rmSync(tempDir, { recursive: true, force: true });

        console.log(`✅ Пакет ${packageName}@${pkg.version} успешно опубликован`);
        console.log(`   URL: ${registry}/${packageName}`);
        return true;

    } catch (error) {
        console.error(`❌ Ошибка публикации: ${error.message}`);
        if (error.stack) console.error(error.stack);
        return false;
    }
}

/**
 * Отзыв пакета (unpublish)
 */
async function unpublishPackage(packageSpecifier) {
    // Разбор имени пакета и версии
    const [packageName, version] = packageSpecifier.split('@');
    const registry = getRegistry();

    console.log(`🗑️  Отзыв ${packageName}${version ? `@${version}` : ''}...`);

    try {
        // Получаем токен
        console.log('   Аутентификация...');
        const token = await getAuthToken();
        if (!token) {
            console.error('❌ Требуется аутентификация. Сначала выполните:');
            console.error('   vladpm логин');
            return false;
        }

        // Определяем URL для отзыва
        let unpublishUrl;
        if (version) {
            // Отзыв конкретной версии
            const tarballName = `${packageName}-${version}.tgz`;
            unpublishUrl = `${registry}/${packageName}/:-/${tarballName}/-rev/1`;
        } else {
            // Полный отзыв пакета
            unpublishUrl = `${registry}/${packageName}/-rev/1`;
        }

        // Выполняем запрос отзыва
        console.log('   Отправка запроса на отзыв...');
        const response = await fetch(unpublishUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await response.text();
        console.log(`   Ответ сервера: ${response.status} ${response.statusText}`);

        if (response.status === 200 || response.status === 201) {
            console.log(`✅ Пакет ${packageName}${version ? `@${version}` : ''} успешно отозван`);

            // Удаляем локально установленную версию, если есть
            const nodeModulesPath = getNodeModulesPath();
            const packagePath = join(nodeModulesPath, packageName);
            if (existsSync(packagePath)) {
                rmSync(packagePath, { recursive: true, force: true });
                console.log(`   Локальная копия удалена`);
            }

            return true;
        } else {
            console.error(`❌ Ошибка отзыва: ${response.status} - ${responseText}`);
            return false;
        }

    } catch (error) {
        console.error(`❌ Ошибка отзыва пакета: ${error.message}`);
        if (error.stack) console.error(error.stack);
        return false;
    }
}
function runScript(scriptName) {
    const pkg = readPackageJson();
    if (!pkg.scripts || !pkg.scripts[scriptName]) {
        console.error(`❌ Скрипт "${scriptName}" не найден в vladx.json`);
        return;
    }

    const command = pkg.scripts[scriptName];
    console.log(`🚀 Запуск скрипта "${scriptName}": ${command}`);

    // Спавним процесс, передавая stdio напрямую в консоль
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true });

    child.on('exit', code => {
        console.log(`🛑 Скрипт "${scriptName}" завершился с кодом ${code}`);
    });
}
function listScripts() {
    const pkg = readPackageJson();
    if (!pkg.scripts || Object.keys(pkg.scripts).length === 0) {
        console.log('📄 Скрипты не найдены в vladx.json');
        return;
    }

    console.log('📄 Скрипты проекта:\n');
    for (const [name, command] of Object.entries(pkg.scripts)) {
        console.log(`  ${name}: ${command}`);
    }
    console.log('');
}

/**
 * Главная функция
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        printHelp();
        return;
    }

    const command = args[0];
    const commandArgs = args.slice(1);

    // Парсинг глобальных опций
    let global = false;
    let dev = false;
    let saveExact = false;
    let registry = null;

    const filteredArgs = commandArgs.filter(arg => {
        if (arg === '-g' || arg === '--global') {
            global = true;
            return false;
        }
        if (arg === '-D' || arg === '--dev') {
            dev = true;
            return false;
        }
        if (arg === '--save-exact') {
            saveExact = true;
            return false;
        }
        if (arg === '--registry') {
            const nextIndex = commandArgs.indexOf('--registry') + 1;
            if (nextIndex < commandArgs.length) {
                registry = commandArgs[nextIndex];
            }
            return false;
        }
        return true;
    });

    // Установка registry
    if (registry) {
        process.env.VLADX_REGISTRY = registry;
    }

    // Выполнение команды
    switch (command) {
        case 'установить':
        case 'install':
        case 'add':
        case 'i':
        case 'a':
            if (filteredArgs.length === 0) {
                // Установка всех зависимостей из vladx.json
                const pkg = readPackageJson();
                for (const [name, version] of Object.entries(pkg.dependencies)) {
                    await installPackage(`${name}@${version}`, { global, dev: false, saveExact });
                }
            } else {
                for (const pkgName of filteredArgs) {
                    await installPackage(pkgName, { global, dev, saveExact });
                }
            }
            break;

        case 'удалить':
        case 'remove':
        case 'uninstall':
        case 'rm':
        case 'un':
        case 'r':
            for (const pkgName of filteredArgs) {
                await removePackage(pkgName, { global });
            }
            break;

        case 'обновить':
        case 'update':
        case 'upgrade':
        case 'up':
        case 'u':
            if (filteredArgs.length === 0) {
                await updatePackages({ global });
            } else {
                for (const pkgName of filteredArgs) {
                    await installPackage(pkgName, { global, dev, saveExact });
                }
            }
            break;

        case 'список':
        case 'list':
        case 'ls':
            listPackages({ global });
            break;

        case 'поиск':
        case 'search':
        case 'find':
        case 's':
            if (filteredArgs.length === 0) {
                console.log('Введите запрос для поиска');
            } else {
                await searchPackage(filteredArgs[0]);
            }
            break;

        case 'информация':
        case 'info':
        case 'view':
        case 'show':
        case 'i':
            if (filteredArgs.length === 0) {
                const pkg = readPackageJson();
                console.log(JSON.stringify(pkg, null, 2));
            } else {
                await packageInfo(filteredArgs[0]);
            }
            break;

        case 'опубликовать':
        case 'publish':
        case 'pub':
        case 'p':
            await publishPackage({ global });
            break;

        case 'отозвать':
        case 'unpublish':
        case 'deprecate':
            if (filteredArgs.length === 0) {
                console.log('Использование: vladpm отозвать <пакет>[@<версия>]');
                console.log('Пример: vladpm отозвать hello-world');
                console.log('Пример: vladpm отозвать hello-world@1.0.0');
            } else {
                const packageSpecifier = filteredArgs[0];
                await unpublishPackage(packageSpecifier);
            }
            break;

        case 'инициализировать':
        case 'init':
        case 'create':
            await initProject({ global });
            break;

        case 'обновить-vladpm':
        case 'self-update':
        case 'selfupdate':
            console.log('Функция обновления vladpm требует реализации');
            break;

        case 'логин':
        case 'login':
        case 'auth':
            await loginToRegistry();
            break;
        case 'скрипт':
case 'run':
    if (filteredArgs.length === 0) {
        console.log('Использование: vladpm run <имя_скрипта>');
    } else {
        const scriptName = filteredArgs[0];
        runScript(scriptName);
    }
    break;
case 'скрипты':
case 'scripts':
    listScripts();
    break;

        case 'выход':
        case 'logout':
            const homeDir = process.env.HOME || process.env.USERPROFILE;
            const npmrcPath = join(homeDir, '.npmrc');
            if (existsSync(npmrcPath)) {
                const content = readFileSync(npmrcPath, 'utf-8');
                const registryUrl = getRegistry().replace(/^https?:\/\//, '');
                const lines = content.split('\n').filter(line => !line.includes(`//${registryUrl}/:_authToken=`));
                writeFileSync(npmrcPath, lines.join('\n'));
                console.log('✅ Выполнен выход из реестра');
            }
            break;

        case '-h':
        case '--help':
            printHelp();
            break;

        case '-v':
        case '--version':
            printVersion();
            break;

        default:
            console.log(`Неизвестная команда: ${command}`);
            console.log('Используйте vladpm --help для справки');
    }
}

// Запуск
main().catch(error => {
    console.error('Критическая ошибка:', error);
    process.exit(1);
});
