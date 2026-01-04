/**
 * IOOperations — Ввод/Вывод с поддержкой потоков
 */

import { createReadStream, createWriteStream, readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, basename, dirname, extname, resolve, normalize } from 'path';

export class IOOperations {
    constructor(securityManager) {
        this.securityManager = securityManager;
    }

    /**
     * Чтение файла (streaming)
     */
    async readFileStream(filePath, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkPath(filePath);
            this.securityManager.checkFileSize(filePath);
        }

        return new Promise((resolve, reject) => {
            const chunks = [];
            const stream = createReadStream(filePath, {
                encoding: options.encoding || 'utf8',
                highWaterMark: options.highWaterMark || 64 * 1024
            });

            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(chunks.join('')));
            stream.on('error', reject);
        });
    }

    /**
     * Чтение файла (sync)
     */
    readFile(filePath, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkPath(filePath);
            this.securityManager.checkFileSize(filePath);
        }

        return readFileSync(filePath, options.encoding || 'utf-8');
    }

    /**
     * Запись файла (streaming)
     */
    async writeFileStream(filePath, content, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkPath(filePath);
        }

        return new Promise((resolve, reject) => {
            const stream = createWriteStream(filePath, {
                encoding: options.encoding || 'utf8'
            });

            stream.on('finish', resolve);
            stream.on('error', reject);
            stream.write(content);
            stream.end();
        });
    }

    /**
     * Запись файла (sync)
     */
    writeFile(filePath, content, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkPath(filePath);
        }

        return writeFileSync(filePath, content, options.encoding || 'utf-8');
    }

    /**
     * Проверка существования файла
     */
    fileExists(filePath) {
        if (this.securityManager) {
            this.securityManager.checkPath(filePath);
        }

        return existsSync(filePath);
    }

    /**
     * Получить информацию о файле
     */
    getFileInfo(filePath) {
        if (this.securityManager) {
            this.securityManager.checkPath(filePath);
        }

        const stats = statSync(filePath);

        return {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            isSymbolicLink: stats.isSymbolicLink(),
            mode: stats.mode,
            uid: stats.uid,
            gid: stats.gid
        };
    }

    /**
     * Прочитать директорию
     */
    readDirectory(dirPath, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkPath(dirPath);
        }

        const files = readdirSync(dirPath, {
            withFileTypes: options.withFileTypes || false
        });

        if (options.recursive) {
            const result = [];

            for (const file of files) {
                const filePath = join(dirPath, file.name || file);

                if (statSync(filePath).isDirectory()) {
                    const subDir = this.readDirectory(filePath, options);
                    result.push(...subDir.map(f => join(file.name || file, f)));
                } else {
                    result.push(file.name || file);
                }
            }

            return result;
        }

        return files;
    }

    /**
     * Создать директорию
     */
    createDirectory(dirPath, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkPath(dirPath);
        }

        const fs = require('fs');
        if (options.recursive) {
            const parentDir = dirname(dirPath);
            if (!existsSync(parentDir)) {
                this.createDirectory(parentDir, options);
            }
        }

        if (!existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: options.recursive });
        }
    }

    /**
     * Удалить файл
     */
    deleteFile(filePath) {
        if (this.securityManager) {
            this.securityManager.checkPath(filePath);
        }

        const fs = require('fs');
        fs.unlinkSync(filePath);
    }

    /**
     * Удалить директорию
     */
    deleteDirectory(dirPath, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkPath(dirPath);
        }

        const fs = require('fs');

        if (options.recursive) {
            const files = this.readDirectory(dirPath);
            for (const file of files) {
                const filePath = join(dirPath, file);
                const stats = statSync(filePath);

                if (stats.isDirectory()) {
                    this.deleteDirectory(filePath, options);
                } else {
                    fs.unlinkSync(filePath);
                }
            }
        }

        fs.rmdirSync(dirPath);
    }

    /**
     * Копировать файл
     */
    copyFile(src, dest) {
        if (this.securityManager) {
            this.securityManager.checkPath(src);
            this.securityManager.checkPath(dest);
        }

        const fs = require('fs');
        fs.copyFileSync(src, dest);
    }

    /**
     * Переместить файл
     */
    moveFile(src, dest) {
        if (this.securityManager) {
            this.securityManager.checkPath(src);
            this.securityManager.checkPath(dest);
        }

        const fs = require('fs');
        fs.renameSync(src, dest);
    }

    /**
     * Смотреть за изменениями файла (watch)
     */
    watchFile(filePath, callback, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkPath(filePath);
        }

        const fs = require('fs');

        const watcher = fs.watch(filePath, options, (eventType, filename) => {
            callback({
                event: eventType,
                filename: filename,
                path: filePath
            });
        });

        return {
            close: () => watcher.close()
        };
    }

    /**
     * Смотреть за изменениями директории
     */
    watchDirectory(dirPath, callback, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkPath(dirPath);
        }

        const fs = require('fs');

        const watcher = fs.watch(dirPath, options, (eventType, filename) => {
            callback({
                event: eventType,
                filename: filename,
                path: dirPath
            });
        });

        return {
            close: () => watcher.close()
        };
    }

    /**
     * Поиск файлов по паттерну
     */
    findFiles(dirPath, pattern, options = {}) {
        const results = [];
        const files = this.readDirectory(dirPath, { recursive: true });

        for (const file of files) {
            const filePath = join(dirPath, file);

            if (pattern instanceof RegExp) {
                if (pattern.test(file)) {
                    results.push(filePath);
                }
            } else if (typeof pattern === 'string') {
                if (file.includes(pattern)) {
                    results.push(filePath);
                }
            }
        }

        return results;
    }

    /**
     * Поиск файлов по расширению
     */
    findByExtension(dirPath, extension, options = {}) {
        return this.findFiles(dirPath, new RegExp(`\\.${extension}$`), options);
    }

    /**
     * Получить размер директории
     */
    getDirectorySize(dirPath) {
        if (this.securityManager) {
            this.securityManager.checkPath(dirPath);
        }

        let totalSize = 0;
        const files = this.readDirectory(dirPath, { recursive: true });

        for (const file of files) {
            const filePath = join(dirPath, file);
            totalSize += statSync(filePath).size;
        }

        return totalSize;
    }

    /**
     * Получить MIME тип файла
     */
    getMimeType(filePath) {
        const ext = extname(filePath).toLowerCase();

        const mimeTypes = {
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.vx': 'text/plain',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };

        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Создать символическую ссылку
     */
    createSymlink(target, linkPath) {
        if (this.securityManager) {
            this.securityManager.checkPath(target);
            this.securityManager.checkPath(linkPath);
        }

        const fs = require('fs');
        fs.symlinkSync(target, linkPath);
    }

    /**
     * Прочитать символическую ссылку
     */
    readSymlink(linkPath) {
        if (this.securityManager) {
            this.securityManager.checkPath(linkPath);
        }

        const fs = require('fs');
        return fs.readlinkSync(linkPath);
    }

    /**
     * Проверить, является ли путь символической ссылкой
     */
    isSymlink(path) {
        if (this.securityManager) {
            this.securityManager.checkPath(path);
        }

        return statSync(path).isSymbolicLink();
    }
}

export default IOOperations;
