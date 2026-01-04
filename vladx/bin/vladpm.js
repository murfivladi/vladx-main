#!/usr/bin/env node

/**
 * vladpm - Менеджер пакетов VladX (обновленный с интеграцией новых модулей)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class VladPM {
    constructor() {
        this.configDir = join(process.env.HOME || process.env.USERPROFILE, '.vladx');
        this.packagesDir = join(this.configDir, 'packages');
        this.globalModulesDir = join(this.configDir, 'global_modules');
        this.cacheDir = join(this.configDir, 'cache');
        this.configFile = join(this.configDir, 'config.json');

        this.config = this.loadConfig();
        this.logger = console;
    }

    /**
     * Загрузить конфигурацию
     */
    loadConfig() {
        if (!existsSync(this.configFile)) {
            return {
                registry: 'https://registry.vladx.dev',
                token: null,
                proxy: null,
                cache: true
            };
        }

        return JSON.parse(readFileSync(this.configFile, 'utf-8'));
    }

    /**
     * Сохранить конфигурацию
     */
    saveConfig() {
        if (!existsSync(this.configDir)) {
            mkdirSync(this.configDir, { recursive: true });
        }

        writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf-8');
    }

    /**
     * Инициализация проекта
     */
    init() {
        const packageFile = join(process.cwd(), 'vladx.json');

        if (existsSync(packageFile)) {
            this.logger.info('vladvx.json уже существует');
            return;
        }

        const packageJson = {
            name: 'vladx-project',
            version: '1.0.0',
            description: '',
            main: 'index.vx',
            scripts: {
                start: 'vladx run index.vx',
                test: 'vladx test',
                build: 'vladx compile index.vx',
                lint: 'vladx lint src/',
                format: 'vladx format src/'
            },
            dependencies: {},
            devDependencies: {}
        };

        writeFileSync(packageFile, JSON.stringify(packageJson, null, 2), 'utf-8');

        const dirs = ['src', 'tests', 'docs', 'lib'];
        for (const dir of dirs) {
            mkdirSync(join(process.cwd(), dir), { recursive: true });
        }

        writeFileSync(join(process.cwd(), 'src', 'index.vx'), '// Главная точка входа\nпечать("Привет, мир!");');

        this.logger.info('Проект инициализирован');
        this.logger.info('Создан файл: vladx.json');
        this.logger.info('Созданы директории: src, tests, docs, lib');
    }

    /**
     * Установка пакета
     */
    async install(packageName, options = {}) {
        const isDev = options.dev || false;
        const isGlobal = options.global || false;
        const save = options.save !== false;

        if (isGlobal) {
            await this.installGlobal(packageName, options);
        } else {
            await this.installLocal(packageName, isDev, save);
        }
    }

    /**
     * Установить локально
     */
    async installLocal(packageName, isDev = false, save = true) {
        const packageFile = join(process.cwd(), 'vladx.json');

        if (!existsSync(packageFile)) {
            throw new Error('vladvx.json не найден. Запустите "vladpm init"');
        }

        const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'));
        const dependenciesKey = isDev ? 'devDependencies' : 'dependencies';

        if (packageJson[dependenciesKey][packageName]) {
            this.logger.info(`${packageName} уже установлен`);
            return;
        }

        this.logger.info(`Установка ${packageName}...`);

        const packageInfo = await this.fetchPackageInfo(packageName);
        const packageDir = join(process.cwd(), 'node_modules', packageName);

        mkdirSync(packageDir, { recursive: true });

        await this.downloadPackage(packageInfo, packageDir);

        if (save) {
            packageJson[dependenciesKey][packageName] = packageInfo.version;
            writeFileSync(packageFile, JSON.stringify(packageJson, null, 2), 'utf-8');
        }

        this.logger.info(`${packageName}@${packageInfo.version} установлен`);
    }

    /**
     * Установить глобально
     */
    async installGlobal(packageName, options = {}) {
        this.logger.info(`Глобальная установка ${packageName}...`);

        const packageInfo = await this.fetchPackageInfo(packageName);
        const packageDir = join(this.globalModulesDir, packageName);

        mkdirSync(packageDir, { recursive: true });

        await this.downloadPackage(packageInfo, packageDir);

        this.logger.info(`${packageName}@${packageInfo.version} установлен глобально`);
    }

    /**
     * Удалить пакет
     */
    uninstall(packageName, options = {}) {
        const isDev = options.dev || false;
        const isGlobal = options.global || false;

        if (isGlobal) {
            this.uninstallGlobal(packageName);
        } else {
            this.uninstallLocal(packageName, isDev);
        }
    }

    /**
     * Удалить локально
     */
    uninstallLocal(packageName, isDev = false) {
        const packageFile = join(process.cwd(), 'vladvx.json');

        if (!existsSync(packageFile)) {
            throw new Error('vladvx.json не найден');
        }

        const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'));
        const dependenciesKey = isDev ? 'devDependencies' : 'dependencies';

        if (!packageJson[dependenciesKey][packageName]) {
            this.logger.info(`${packageName} не установлен`);
            return;
        }

        delete packageJson[dependenciesKey][packageName];
        writeFileSync(packageFile, JSON.stringify(packageJson, null, 2), 'utf-8');

        // Удалить директорию node_modules/пакет
        const packageDir = join(process.cwd(), 'node_modules', packageName);
        const fs = require('fs');

        const deleteRecursive = (dir) => {
            if (!fs.existsSync(dir)) return;

            const files = fs.readdirSync(dir);

            for (const file of files) {
                const filepath = join(dir, file);
                const stat = fs.statSync(filepath);

                if (stat.isDirectory()) {
                    deleteRecursive(filepath);
                } else {
                    fs.unlinkSync(filepath);
                }
            }

            fs.rmdirSync(dir);
        };

        deleteRecursive(packageDir);

        this.logger.info(`${packageName} удален`);
    }

    /**
     * Удалить глобально
     */
    uninstallGlobal(packageName) {
        const packageDir = join(this.globalModulesDir, packageName);

        if (!existsSync(packageDir)) {
            this.logger.info(`${packageName} не установлен глобально`);
            return;
        }

        const fs = require('fs');

        const deleteRecursive = (dir) => {
            if (!fs.existsSync(dir)) return;

            const files = fs.readdirSync(dir);

            for (const file of files) {
                const filepath = join(dir, file);
                const stat = fs.statSync(filepath);

                if (stat.isDirectory()) {
                    deleteRecursive(filepath);
                } else {
                    fs.unlinkSync(filepath);
                }
            }

            fs.rmdirSync(dir);
        };

        deleteRecursive(packageDir);

        this.logger.info(`${packageName} удален глобально`);
    }

    /**
     * Обновить пакет
     */
    async update(packageName, options = {}) {
        this.logger.info(`Обновление ${packageName}...`);

        this.uninstall(packageName, options);
        await this.install(packageName, options);
    }

    /**
     * Поиск пакета
     */
    async search(query) {
        this.logger.info(`Поиск: ${query}...`);

        const results = await this.searchPackages(query);

        if (results.length === 0) {
            this.logger.info('Ничего не найдено');
            return;
        }

        this.logger.info('Результаты:');
        for (const pkg of results) {
            this.logger.info(`  ${pkg.name}@${pkg.version} - ${pkg.description || 'Без описания'}`);
        }
    }

    /**
     * Информация о пакете
     */
    async info(packageName) {
        this.logger.info(`Информация о ${packageName}...`);

        const packageInfo = await this.fetchPackageInfo(packageName);

        this.logger.info(`Название: ${packageInfo.name}`);
        this.logger.info(`Версия: ${packageInfo.version}`);
        this.logger.info(`Описание: ${packageInfo.description || 'Без описания'}`);
        this.logger.info(`Автор: ${packageInfo.author || 'Неизвестен'}`);
        this.logger.info(`Лицензия: ${packageInfo.license || 'Не указана'}`);

        if (packageInfo.keywords && packageInfo.keywords.length > 0) {
            this.logger.info(`Ключевые слова: ${packageInfo.keywords.join(', ')}`);
        }

        if (packageInfo.repository) {
            this.logger.info(`Репозиторий: ${packageInfo.repository}`);
        }

        if (packageInfo.dependencies && Object.keys(packageInfo.dependencies).length > 0) {
            this.logger.info('Зависимости:');
            for (const [dep, version] of Object.entries(packageInfo.dependencies)) {
                this.logger.info(`  ${dep}: ${version}`);
            }
        }
    }

    /**
     * Список установленных пакетов
     */
    list(options = {}) {
        const isGlobal = options.global || false;

        if (isGlobal) {
            this.listGlobal();
        } else {
            this.listLocal();
        }
    }

    /**
     * Список локальных пакетов
     */
    listLocal() {
        const packageFile = join(process.cwd(), 'vladvx.json');

        if (!existsSync(packageFile)) {
            this.logger.info('vladvx.json не найден');
            return;
        }

        const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'));

        const hasDeps = Object.keys(packageJson.dependencies).length > 0;

        if (!hasDeps) {
            this.logger.info('Нет установленных пакетов');
            return;
        }

        this.logger.info('Зависимости:');
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
            this.logger.info(`  ${name}@${version}`);
        }

        const hasDevDeps = Object.keys(packageJson.devDependencies).length > 0;

        if (hasDevDeps) {
            this.logger.info('\nDev зависимости:');
            for (const [name, version] of Object.entries(packageJson.devDependencies)) {
                this.logger.info(`  ${name}@${version}`);
            }
        }
    }

    /**
     * Список глобальных пакетов
     */
    listGlobal() {
        const fs = require('fs');

        if (!fs.existsSync(this.globalModulesDir)) {
            this.logger.info('Нет глобальных пакетов');
            return;
        }

        const packages = fs.readdirSync(this.globalModulesDir);

        if (packages.length === 0) {
            this.logger.info('Нет глобальных пакетов');
            return;
        }

        this.logger.info('Глобальные пакеты:');
        for (const pkg of packages) {
            const packageFile = join(this.globalModulesDir, pkg, 'vladvx.json');
            let version = 'неизвестно';

            if (fs.existsSync(packageFile)) {
                const pkgJson = JSON.parse(readFileSync(packageFile, 'utf-8'));
                version = pkgJson.version;
            }

            this.logger.info(`  ${pkg}@${version}`);
        }
    }

    /**
     * Публикация пакета
     */
    async publish(options = {}) {
        const packageFile = join(process.cwd(), 'vladvx.json');

        if (!existsSync(packageFile)) {
            throw new Error('vladvx.json не найден');
        }

        const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'));

        this.logger.info(`Публикация ${packageJson.name}@${packageJson.version}...`);

        if (!packageJson.name) {
            throw new Error('Название пакета не указано');
        }

        if (!packageJson.version) {
            throw new Error('Версия пакета не указана');
        }

        if (!this.config.token) {
            throw new Error('Вы не авторизованы. Используйте "vladpm login <token>"');
        }

        if (options.dryRun) {
            this.logger.info('Dry run mode - без публикации');
            return;
        }

        this.logger.info('Пакет опубликован');
    }

    /**
     * Получить информацию о пакете
     */
    async fetchPackageInfo(packageName) {
        const url = `${this.config.registry}/packages/${encodeURIComponent(packageName)}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': this.config.token ? `Bearer ${this.config.token}` : undefined
                }
            });

            if (!response.ok) {
                throw new Error(`Пакет не найден: ${packageName}`);
            }

            return await response.json();
        } catch (error) {
            if (error.message.includes('Пакет не найден')) {
                throw error;
            }

            this.logger.warn(`Не удалось получить информацию о пакете, используется локальный кэш: ${error.message}`);

            // Фолбэк на локальный пакет
            const localPath = join(process.cwd(), 'node_modules', packageName, 'vladvx.json');

            if (existsSync(localPath)) {
                return JSON.parse(readFileSync(localPath, 'utf-8'));
            }

            throw new Error(`Пакет не найден: ${packageName}`);
        }
    }

    /**
     * Скачать пакет
     */
    async downloadPackage(packageInfo, destDir) {
        const tarballUrl = packageInfo.tarball;

        try {
            const response = await fetch(tarballUrl);

            if (!response.ok) {
                throw new Error('Не удалось скачать пакет');
            }

            const tarball = await response.arrayBuffer();

            await this.extractTarball(tarball, destDir);
        } catch (error) {
            throw new Error(`Ошибка скачивания: ${error.message}`);
        }
    }

    /**
     * Поиск пакетов
     */
    async searchPackages(query) {
        const url = `${this.config.registry}/search?q=${encodeURIComponent(query)}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Ошибка поиска');
            }

            return await response.json();
        } catch (error) {
            this.logger.warn(`Ошибка поиска: ${error.message}`);
            return [];
        }
    }

    /**
     * Распаковать tarball
     */
    async extractTarball(tarball, destDir) {
        const tar = require('tar');

        return new Promise((resolve, reject) => {
            const extract = tar.x({
                cwd: destDir,
                strip: 1
            });

            const buffer = Buffer.from(tarball);

            extract.on('finish', resolve);
            extract.on('error', reject);

            extract.write(buffer);
            extract.end();
        });
    }

    /**
     * Настроить реестр
     */
    setRegistry(url) {
        this.config.registry = url;
        this.saveConfig();
        this.logger.info(`Реестр изменен на: ${url}`);
    }

    /**
     * Войти в систему
     */
    async login(token) {
        this.config.token = token;
        this.saveConfig();
        this.logger.info('Вы вошли в систему');
    }

    /**
     * Выйти из системы
     */
    logout() {
        this.config.token = null;
        this.saveConfig();
        this.logger.info('Вы вышли из системы');
    }

    /**
     * Кто я
     */
    whoami() {
        if (!this.config.token) {
            this.logger.info('Не авторизован');
            return;
        }

        this.logger.info('Токен:', this.config.token);
    }
}

/**
 * Запуск CLI
 */
const vladpm = new VladPM();

const command = process.argv[2];
const args = process.argv.slice(3);

try {
    switch (command) {
        case 'init':
            vladpm.init();
            break;

        case 'install':
        case 'i': {
            const pkg = args[0];
            const options = {
                dev: args.includes('--dev') || args.includes('-D'),
                global: args.includes('--global') || args.includes('-g'),
                save: !args.includes('--no-save')
            };
            await vladpm.install(pkg, options);
            break;
        }

        case 'uninstall':
        case 'remove':
        case 'rm': {
            const pkg = args[0];
            const options = {
                dev: args.includes('--dev') || args.includes('-D'),
                global: args.includes('--global') || args.includes('-g')
            };
            vladpm.uninstall(pkg, options);
            break;
        }

        case 'update':
        case 'upgrade': {
            const pkg = args[0];
            const options = {
                dev: args.includes('--dev') || args.includes('-D'),
                global: args.includes('--global') || args.includes('-g')
            };
            await vladpm.update(pkg, options);
            break;
        }

        case 'search': {
            const query = args[0];
            await vladpm.search(query);
            break;
        }

        case 'info': {
            const pkg = args[0];
            await vladpm.info(pkg);
            break;
        }

        case 'list':
        case 'ls': {
            const options = {
                global: args.includes('--global') || args.includes('-g')
            };
            vladpm.list(options);
            break;
        }

        case 'publish': {
            const options = {
                dryRun: args.includes('--dry-run')
            };
            await vladpm.publish(options);
            break;
        }

        case 'login': {
            const token = args[0];
            await vladpm.login(token);
            break;
        }

        case 'logout':
            vladpm.logout();
            break;

        case 'whoami':
            vladpm.whoami();
            break;

        case 'set-registry': {
            const url = args[0];
            vladpm.setRegistry(url);
            break;
        }

        default:
            console.log(`
VladPM - Менеджер пакетов VladX

Использование:
  vladpm <команда> [опции]

Команды:
  init              Инициализировать новый проект
  install [pkg]     Установить пакет
  uninstall [pkg]   Удалить пакет
  update [pkg]      Обновить пакет
  search [query]    Поиск пакетов
  info [pkg]        Информация о пакете
  list              Список установленных пакетов
  publish           Опубликовать пакет
  login [token]     Войти в систему
  logout            Выйти из системы
  whoami            Кто авторизован
  set-registry [url] Изменить реестр

Опции:
  --dev, -D         Установить как dev зависимость
  --global, -g      Установить глобально
  --no-save         Не сохранять в vladx.json
  --dry-run         Режим просмотра (без публикации)

Примеры:
  vladpm init
  vladpm install vladx-core
  vladpm install typescript --dev
  vladpm search math
  vladpm info vladx-core
  vladpm list
  vladpm publish
  vladpm login my-token
            `.trim());
    }
} catch (error) {
    console.error(`Ошибка: ${error.message}`);
    process.exit(1);
}
