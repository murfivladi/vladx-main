/**
 * NetworkOperations — Сетевые операции
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

export class NetworkOperations {
    constructor(securityManager) {
        this.securityManager = securityManager;
        this.defaultOptions = {
            timeout: 30000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'VladX/1.0'
            }
        };
    }

    /**
     * HTTP GET запрос
     */
    async get(url, options = {}) {
        return this.request(url, {
            ...options,
            method: 'GET'
        });
    }

    /**
     * HTTP POST запрос
     */
    async post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: data
        });
    }

    /**
     * HTTP PUT запрос
     */
    async put(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PUT',
            body: data
        });
    }

    /**
     * HTTP DELETE запрос
     */
    async delete(url, options = {}) {
        return this.request(url, {
            ...options,
            method: 'DELETE'
        });
    }

    /**
     * HTTP PATCH запрос
     */
    async patch(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PATCH',
            body: data
        });
    }

    /**
     * Общий HTTP запрос
     */
    async request(url, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkURL(url);
        }

        const mergedOptions = {
            ...this.defaultOptions,
            ...options
        };

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;

            const reqOptions = {
                method: mergedOptions.method,
                headers: {
                    ...mergedOptions.headers
                },
                timeout: mergedOptions.timeout
            };

            const req = client.request(url, reqOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    const response = {
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers,
                        data: this.parseResponse(data, res.headers['content-type'])
                    };

                    // Редиректы
                    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                        if (mergedOptions.maxRedirects > 0) {
                            this.request(res.headers.location, {
                                ...mergedOptions,
                                maxRedirects: mergedOptions.maxRedirects - 1
                            }).then(resolve).catch(reject);
                            return;
                        }
                    }

                    resolve(response);
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Request timeout: ${url}`));
            });

            if (mergedOptions.body) {
                req.write(mergedOptions.body);
            }

            req.end();
        });
    }

    /**
     * Парсинг ответа
     */
    parseResponse(data, contentType) {
        if (!contentType) return data;

        if (contentType.includes('application/json')) {
            try {
                return JSON.parse(data);
            } catch (e) {
                return data;
            }
        }

        return data;
    }

    /**
     * Download файла
     */
    async downloadFile(url, destPath) {
        if (this.securityManager) {
            this.securityManager.checkURL(url);
            this.securityManager.checkPath(destPath);
        }

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            const fs = require('fs');
            const file = fs.createWriteStream(destPath);

            client.get(url, (response) => {
                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve(destPath);
                });
            }).on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });
    }

    /**
     * Upload файла
     */
    async uploadFile(url, filePath, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkURL(url);
            this.securityManager.checkPath(filePath);
        }

        const fs = require('fs');
        const formData = require('form-data');

        const form = new FormData();
        const stats = fs.statSync(filePath);

        form.append('file', fs.createReadStream(filePath), {
            filename: require('path').basename(filePath),
            knownLength: stats.size
        });

        const formHeaders = form.getHeaders();

        return this.request(url, {
            ...options,
            method: 'POST',
            headers: {
                ...options.headers,
                ...formHeaders
            },
            body: form
        });
    }

    /**
     * WebSocket соединение
     */
    createWebSocket(url, options = {}) {
        if (this.securityManager) {
            this.securityManager.checkURL(url);
        }

        const WebSocket = require('ws');
        return new WebSocket(url, options);
    }

    /**
     * Создать HTTP сервер
     */
    createServer(port, handler, options = {}) {
        const server = http.createServer((req, res) => {
            // CORS
            if (options.cors) {
                res.setHeader('Access-Control-Allow-Origin', options.cors.origin || '*');
                res.setHeader('Access-Control-Allow-Methods', options.cors.methods || 'GET, POST, PUT, DELETE');
                res.setHeader('Access-Control-Allow-Headers', options.cors.headers || 'Content-Type');
            }

            // Logging
            if (options.logging) {
                console.log(`${req.method} ${req.url}`);
            }

            handler(req, res);
        });

        server.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });

        return server;
    }

    /**
     * Создать HTTPS сервер
     */
    createHttpsServer(port, handler, options = {}) {
        const server = https.createServer(options.credentials || {}, (req, res) => {
            // CORS
            if (options.cors) {
                res.setHeader('Access-Control-Allow-Origin', options.cors.origin || '*');
                res.setHeader('Access-Control-Allow-Methods', options.cors.methods || 'GET, POST, PUT, DELETE');
                res.setHeader('Access-Control-Allow-Headers', options.cors.headers || 'Content-Type');
            }

            handler(req, res);
        });

        server.listen(port, () => {
            console.log(`HTTPS Server running on port ${port}`);
        });

        return server;
    }

    /**
     * Проверить доступность URL
     */
    async checkUrl(url) {
        try {
            const response = await this.head(url);
            return response.status >= 200 && response.status < 400;
        } catch (error) {
            return false;
        }
    }

    /**
     * HEAD запрос
     */
    async head(url, options = {}) {
        return this.request(url, {
            ...options,
            method: 'HEAD'
        });
    }

    /**
     * OPTIONS запрос
     */
    async options(url, options = {}) {
        return this.request(url, {
            ...options,
            method: 'OPTIONS'
        });
    }

    /**
     * Отправить FormData
     */
    async sendForm(url, formData, options = {}) {
        if (typeof formData === 'object') {
            const form = new FormData();
            for (const [key, value] of Object.entries(formData)) {
                form.append(key, value);
            }
            formData = form;
        }

        const formHeaders = formData.getHeaders();

        return this.request(url, {
            ...options,
            method: 'POST',
            headers: {
                ...options.headers,
                ...formHeaders
            },
            body: formData
        });
    }

    /**
     * multipart/form-data
     */
    createMultipartForm() {
        const boundary = `----VladX${Date.now()}`;
        const parts = [];

        return {
            addField: (name, value) => {
                parts.push(
                    `--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
                    `${value}\r\n`
                );
            },
            addFile: (name, filename, content, contentType) => {
                parts.push(
                    `--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
                    `Content-Type: ${contentType || 'application/octet-stream'}\r\n\r\n` +
                    `${content}\r\n`
                );
            },
            build: () => {
                return parts.join('') + `--${boundary}--\r\n`;
            },
            getContentType: () => {
                return `multipart/form-data; boundary=${boundary}`;
            }
        };
    }
}

export default NetworkOperations;
