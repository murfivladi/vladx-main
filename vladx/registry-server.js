/**
 * VladX Registry Server — Полнофункциональный реестр пакетов
 * Реализует полный API для vladpm с аутентификацией, публикацией и управлением пакетами
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Конфигурация
const PORT = process.env.PORT || 4873;
const SECRET_KEY = process.env.JWT_SECRET || 'vladpm-secret-key';
const REGISTRY_PATH = process.env.REGISTRY_PATH || path.join(__dirname, 'registry-data');

// Создание директорий
if (!fs.existsSync(REGISTRY_PATH)) {
    fs.mkdirSync(REGISTRY_PATH, { recursive: true });
}

// Пути для данных
const USERS_FILE = path.join(REGISTRY_PATH, 'users.json');
const PACKAGES_FILE = path.join(REGISTRY_PATH, 'packages.json');
const TOKENS_FILE = path.join(REGISTRY_PATH, 'tokens.json');

// Загрузка данных
function loadData(filePath, defaultValue = {}) {
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return defaultValue;
}

// Сохранение данных
function saveData(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Инициализация данных
let users = loadData(USERS_FILE);
let packages = loadData(PACKAGES_FILE);
let tokens = loadData(TOKENS_FILE);

// Инициализация Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Storage для загрузки tarball
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware для аутентификации
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'Требуется аутентификация' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Неверный токен' });
    }
}

// Вспомогательные функции
function generateToken(userId) {
    const token = jwt.sign({ userId }, SECRET_KEY, { expiresIn: '30d' });
    tokens[token] = { userId, createdAt: new Date().toISOString() };
    saveData(TOKENS_FILE, tokens);
    return token;
}

function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

// API Routes - Специальные маршруты (должны быть до catch-all)

// 1. Регистрация/аутентификация пользователя
app.put('/-/user/:user', async (req, res) => {
    try {
        const { name, password, email } = req.body;

        if (!name || !password) {
            return res.status(400).json({ error: 'Требуются имя и пароль' });
        }

        // Проверяем, существует ли пользователь
        if (users[name]) {
            // Проверяем пароль
            if (verifyPassword(password, users[name].password)) {
                const token = generateToken(name);
                return res.json({
                    ok: true,
                    id: `org.couchdb.user:${name}`,
                    name,
                    email,
                    token
                });
            } else {
                return res.status(401).json({ error: 'Неверный пароль' });
            }
        }

        // Создаем нового пользователя
        users[name] = {
            name,
            password: hashPassword(password),
            email,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        saveData(USERS_FILE, users);

        const token = generateToken(name);

        res.json({
            ok: true,
            id: `org.couchdb.user:${name}`,
            name,
            email,
            token
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Получение информации о пользователе
app.get('/-/user/:user', authenticateToken, (req, res) => {
    try {
        const username = req.params.user.replace('org.couchdb.user:', '');

        if (users[username]) {
            res.json({
                _id: `org.couchdb.user:${username}`,
                name: username,
                email: users[username].email,
                type: 'user',
                roles: [],
                date: users[username].updatedAt
            });
        } else {
            res.status(404).json({ error: 'Пользователь не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Поиск всех пакетов
app.get('/-/all', (req, res) => {
    try {
        const allPackages = Object.entries(packages).map(([name, pkg]) => ({
            name,
            package: {
                name,
                version: pkg['dist-tags']?.latest || Object.keys(pkg.versions)[0] || '1.0.0',
                description: pkg.description || '',
                keywords: pkg.keywords || [],
                author: pkg.author || '',
                license: pkg.license || 'MIT',
                date: pkg.time?.created || new Date().toISOString()
            }
        }));

        res.json({
            objects: allPackages,
            total: allPackages.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Поиск пакетов по запросу
app.get('/-/search', (req, res) => {
    try {
        const query = req.query.text || '';
        const size = parseInt(req.query.size) || 20;
        const from = parseInt(req.query.from) || 0;

        const allPackages = Object.entries(packages).map(([name, pkg]) => ({
            name,
            version: pkg['dist-tags']?.latest || Object.keys(pkg.versions)[0] || '1.0.0',
            description: pkg.description || '',
            keywords: pkg.keywords || [],
            author: pkg.author || '',
            license: pkg.license || 'MIT',
            date: pkg.time?.created || new Date().toISOString()
        }));

        const filteredPackages = allPackages.filter(pkg =>
            pkg.name.toLowerCase().includes(query.toLowerCase()) ||
            (pkg.description && pkg.description.toLowerCase().includes(query.toLowerCase())) ||
            (pkg.keywords && pkg.keywords.some(kw => kw.toLowerCase().includes(query.toLowerCase())))
        );

        const results = filteredPackages.slice(from, from + size);

        res.json({
            objects: results,
            total: filteredPackages.length,
            time: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Статистика
app.get('/-/stats', (req, res) => {
    try {
        const totalPackages = Object.keys(packages).length;
        const totalUsers = Object.keys(users).length;
        const totalDownloads = Object.values(packages).reduce((sum, pkg) => {
            return sum + (pkg.downloads || 0);
        }, 0);

        res.json({
            total_packages: totalPackages,
            total_users: totalUsers,
            total_downloads: totalDownloads,
            server_time: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Проверка аутентификации
app.get('/-/whoami', authenticateToken, (req, res) => {
    res.json({ username: req.user.userId });
});

// 7. Health check
app.get('/-/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 8. Проверка токена
app.get('/-/token/:token', (req, res) => {
    const token = req.params.token;

    if (tokens[token]) {
        res.json({ valid: true, user: tokens[token].userId });
    } else {
        res.json({ valid: false });
    }
});

// API Routes - Маршруты для пакетов (catch-all routes, должны быть после специальных)

// 9. Получение информации о пакете (для scoped пакетов)
app.get('/@:scope/:name', (req, res) => {
    try {
        const packageName = `@${req.params.scope}/${req.params.name}`;

        if (packages[packageName]) {
            res.json(packages[packageName]);
        } else {
            res.status(404).json({ error: 'Пакет не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 10. Получение информации о пакете (для обычных пакетов)
app.get('/:name', (req, res) => {
    try {
        const packageName = req.params.name;

        // Проверяем, не является ли это специальным маршрутом
        if (packageName.startsWith('-') || req.path.startsWith('/-/')) {
            return res.status(404).json({ error: 'Маршрут не найден' });
        }

        if (packages[packageName]) {
            res.json(packages[packageName]);
        } else {
            res.status(404).json({ error: 'Пакет не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 10. Получение конкретной версии пакета (поддержка scoped пакетов)
// This route is problematic as it could match special routes, so let's not use it
// We'll rely on the main package route and let the client handle version selection

// 10. Получение конкретной версии пакета
app.get('/:package/:version', (req, res) => {
    try {
        const packageName = req.params.package;
        const version = req.params.version;
        
        if (packages[packageName] && packages[packageName].versions[version]) {
            res.json(packages[packageName].versions[version]);
        } else {
            res.status(404).json({ error: 'Пакет или версия не найдены' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 11. Список версий пакета
app.get('/:package/versions', (req, res) => {
    try {
        const packageName = req.params.package;
        
        if (packages[packageName]) {
            res.json({
                name: packageName,
                versions: Object.keys(packages[packageName].versions)
            });
        } else {
            res.status(404).json({ error: 'Пакет не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 12. Публикация/обновление пакета (поддержка scoped пакетов)
app.put(/\/(@[^\/]+\/[^\/]+|[^\/]+)/, authenticateToken, upload.none(), async (req, res) => {
    try {
        // Extract package name from URL
        const pathParts = req.path.substring(1).split('/'); // Remove leading '/'
        let packageName = pathParts[0];

        // For scoped packages (@scope/name), combine the first two parts
        if (packageName.startsWith('@') && pathParts.length > 1) {
            packageName = `${packageName}/${pathParts[1]}`;
        }

        const packageData = req.body;

        // Проверяем права на публикацию
        if (packageData._id !== packageName) {
            return res.status(400).json({ error: 'Несоответствие имени пакета' });
        }

        // Загружаем существующий пакет, если он есть
        let existingPackage = null;
        if (packages[packageName]) {
            existingPackage = packages[packageName];
        } else {
            // Проверяем, есть ли пакет в файловой системе (вдруг данные не в памяти)
            try {
                const packageFile = path.join(REGISTRY_PATH, 'packages', packageName, 'package.json');
                if (fs.existsSync(packageFile)) {
                    existingPackage = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
                }
            } catch (e) {
                // Если не удалось загрузить из файла, продолжаем без существующего пакета
            }
        }

        let newPackageData = null;

        // Если существует предыдущий пакет, объединяем данные
        if (existingPackage) {
            newPackageData = { ...existingPackage };

            // Объединяем версии
            if (packageData.versions) {
                if (!newPackageData.versions) {
                    newPackageData.versions = {};
                }
                Object.assign(newPackageData.versions, packageData.versions);
            }

            // Обновляем dist-tags
            if (packageData['dist-tags']) {
                if (!newPackageData['dist-tags']) {
                    newPackageData['dist-tags'] = {};
                }
                Object.assign(newPackageData['dist-tags'], packageData['dist-tags']);
            }

            // Обновляем остальные поля, но сохраняем важные метаданные
            for (const [key, value] of Object.entries(packageData)) {
                if (!['versions', 'dist-tags', '_attachments'].includes(key)) {
                    newPackageData[key] = value;
                }
            }
        } else {
            // Новый пакет
            newPackageData = packageData;
        }

        // Сохраняем обновленный пакет
        packages[packageName] = newPackageData;
        saveData(PACKAGES_FILE, packages);

        // Создаем директорию для пакета
        const packageDir = path.join(REGISTRY_PATH, 'packages', packageName);
        if (!fs.existsSync(packageDir)) {
            fs.mkdirSync(packageDir, { recursive: true });
        }

        // Сохраняем tarball'ы если есть
        if (packageData._attachments) {
            for (const [filename, attachment] of Object.entries(packageData._attachments)) {
                const filePath = path.join(packageDir, filename);
                const buffer = Buffer.from(attachment.data, 'base64');
                fs.writeFileSync(filePath, buffer);
            }
        }

        res.json({
            ok: true,
            id: packageName,
            rev: Date.now().toString()
        });
    } catch (error) {
        console.error('Ошибка публикации пакета:', error);
        res.status(500).json({ error: error.message });
    }
});

// 13. Отзыв/удаление конкретной версии пакета (поддержка scoped пакетов)
app.delete('/:package*/:-/:filename/-rev/:rev', authenticateToken, (req, res) => {
    try {
        const packageName = req.params[0]; // Используем wildcard параметр для scoped пакетов
        const filename = req.params.filename;

        if (packages[packageName]) {
            // Удаляем конкретную версию из пакета
            const version = filename.replace(/.*-([0-9]+\.[0-9]+\.[0-9]+)\.tgz$/, '$1');
            if (packages[packageName].versions && packages[packageName].versions[version]) {
                delete packages[packageName].versions[version];

                // Если это была последняя версия, удаляем весь пакет
                if (Object.keys(packages[packageName].versions).length === 0) {
                    delete packages[packageName];
                }

                saveData(PACKAGES_FILE, packages);

                // Удаляем файл tarball
                const packageDir = path.join(REGISTRY_PATH, 'packages', packageName);
                const filePath = path.join(packageDir, filename);
                if (fs.existsSync(filePath)) {
                    fs.rmSync(filePath, { force: true });
                }

                // Если директория пакета пуста, удаляем её
                if (fs.existsSync(packageDir)) {
                    const files = fs.readdirSync(packageDir);
                    if (files.length === 0) {
                        fs.rmSync(packageDir, { recursive: true, force: true });
                    }
                }

                res.json({
                    ok: true,
                    id: packageName,
                    deleted: true
                });
            } else {
                res.status(404).json({ error: 'Версия пакета не найдена' });
            }
        } else {
            res.status(404).json({ error: 'Пакет не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 14. Полное удаление пакета (unpublish) (поддержка scoped пакетов)
app.delete('/:package*/-rev/:rev', authenticateToken, (req, res) => {
    try {
        const packageName = req.params[0]; // Используем wildcard параметр для scoped пакетов

        if (packages[packageName]) {
            // Проверяем, что пользователь является владельцем пакета
            // В простой реализации разрешаем всем, кто аутентифицирован
            // В реальной системе нужно проверять владельца

            delete packages[packageName];
            saveData(PACKAGES_FILE, packages);

            // Удаляем файлы пакета
            const packageDir = path.join(REGISTRY_PATH, 'packages', packageName);
            if (fs.existsSync(packageDir)) {
                fs.rmSync(packageDir, { recursive: true, force: true });
            }

            res.json({
                ok: true,
                id: packageName,
                deleted: true
            });
        } else {
            res.status(404).json({ error: 'Пакет не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 15. Альтернативный маршрут для unpublish (совместимость) (поддержка scoped пакетов)
app.delete('/:package*', authenticateToken, (req, res) => {
    try {
        const packageName = req.params[0]; // Используем wildcard параметр для scoped пакетов

        // Проверяем, есть ли параметр _rev в запросе (для совместимости)
        const rev = req.query._rev || req.headers['x-rev'];

        if (packages[packageName]) {
            delete packages[packageName];
            saveData(PACKAGES_FILE, packages);

            // Удаляем файлы пакета
            const packageDir = path.join(REGISTRY_PATH, 'packages', packageName);
            if (fs.existsSync(packageDir)) {
                fs.rmSync(packageDir, { recursive: true, force: true });
            }

            res.json({
                ok: true,
                id: packageName,
                deleted: true
            });
        } else {
            res.status(404).json({ error: 'Пакет не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 14. Скачивание tarball (для scoped пакетов)
app.get('/@:scope/:name/-/:filename', (req, res) => {
    try {
        const packageName = `@${req.params.scope}/${req.params.name}`;
        const filename = req.params.filename;

        const filePath = path.join(REGISTRY_PATH, 'packages', packageName, filename);

        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).json({ error: 'Файл не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 15. Скачивание tarball (для обычных пакетов)
app.get('/:name/-/:filename', (req, res) => {
    try {
        const packageName = req.params.name;
        const filename = req.params.filename;

        // Проверяем, не является ли это специальным маршрутом
        if (packageName.startsWith('-')) {
            return res.status(404).json({ error: 'Маршрут не найден' });
        }

        const filePath = path.join(REGISTRY_PATH, 'packages', packageName, filename);

        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).json({ error: 'Файл не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 15. Скачивание конкретной версии (поддержка scoped пакетов)
app.get('/:package*/download/:package-:version.tgz', (req, res) => {
    try {
        const packageName = req.params[0]; // Используем wildcard параметр для scoped пакетов
        const version = req.params.version;
        
        if (packages[packageName] && packages[packageName].versions[version]) {
            const tarballUrl = packages[packageName].versions[version].dist.tarball;
            const filename = path.basename(tarballUrl);
            
            const filePath = path.join(REGISTRY_PATH, 'packages', packageName, filename);
            
            if (fs.existsSync(filePath)) {
                // Увеличиваем счетчик скачиваний
                if (!packages[packageName].downloads) {
                    packages[packageName].downloads = 0;
                }
                packages[packageName].downloads++;
                saveData(PACKAGES_FILE, packages);
                
                res.sendFile(filePath);
            } else {
                res.status(404).json({ error: 'Файл не найден' });
            }
        } else {
            res.status(404).json({ error: 'Пакет или версия не найдены' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Обработка 404
app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 VladX Registry Server запущен на порту ${PORT}`);
    console.log(`📦 Путь к данным: ${REGISTRY_PATH}`);
    console.log(`🔐 Секретный ключ: ${SECRET_KEY.substring(0, 5)}...`);
    console.log(`📊 Статус: ${Object.keys(packages).length} пакетов, ${Object.keys(users).length} пользователей`);
    console.log(`\nДоступные API маршруты:`);
    console.log(`  GET  /:package                    - Получить информацию о пакете`);
    console.log(`  GET  /:package/:version            - Получить конкретную версию`);
    console.log(`  PUT  /:package                     - Опубликовать/обновить пакет`);
    console.log(`  GET  /-/all                        - Получить все пакеты`);
    console.log(`  GET  /-/search?text=query          - Поиск пакетов`);
    console.log(`  PUT  /-/user/:user                 - Регистрация/аутентификация`);
    console.log(`  GET  /-/stats                      - Статистика`);
    console.log(`  GET  /-/health                     - Проверка работоспособности`);
});

export default app;