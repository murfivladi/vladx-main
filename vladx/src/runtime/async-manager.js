/**
 * AsyncManager — Управление асинхронными операциями
 */

import { VladXObject } from './vladx-object.js';

export class AsyncManager {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 10;
        this.timeout = options.timeout || 30000;
        this.activePromises = new Set();
        this.queue = [];
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0,
            timeout: 0
        };
    }

    /**
     * Параллельное выполнение
     */
    async parallel(tasks, options = {}) {
        const maxConcurrency = options.maxConcurrency || this.maxConcurrent;
        const timeout = options.timeout || this.timeout;

        if (tasks.length === 0) {
            return VladXObject.array([]);
        }

        const results = [];
        const executing = new Set();

        const processTask = async (task, index) => {
            try {
                const result = await Promise.race([
                    task(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), timeout)
                    )
                ]);
                results[index] = result;
                this.stats.completed++;
            } catch (error) {
                results[index] = { error: error.message };
                this.stats.failed++;
            } finally {
                executing.delete(processTask);

                if (this.queue.length > 0) {
                    const next = this.queue.shift();
                    executing.add(next);
                    next();
                }
            }
        };

        for (let i = 0; i < tasks.length; i++) {
            if (executing.size >= maxConcurrency) {
                await new Promise(resolve => {
                    const taskWrapper = () => {
                        processTask(tasks[i], i).then(resolve);
                    };
                    this.queue.push(taskWrapper);
                });
            } else {
                const promise = processTask(tasks[i], i);
                executing.add(promise);
            }
        }

        await Promise.all(executing);
        this.stats.total += tasks.length;

        return VladXObject.array(results);
    }

    /**
     * Sequential выполнение
     */
    async sequential(tasks) {
        const results = [];

        for (const task of tasks) {
            try {
                const result = await Promise.race([
                    task(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), this.timeout)
                    )
                ]);
                results.push(result);
                this.stats.completed++;
            } catch (error) {
                results.push({ error: error.message });
                this.stats.failed++;
            }
        }

        this.stats.total += tasks.length;
        return VladXObject.array(results);
    }

    /**
     * Race - первый завершившийся промис
     */
    async race(tasks) {
        if (tasks.length === 0) {
            return VladXObject.null();
        }

        try {
            const result = await Promise.race([
                Promise.race(tasks.map(t => t())),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), this.timeout)
                )
            ]);
            return VladXObject.fromJS(result);
        } catch (error) {
            this.stats.failed++;
            throw error;
        }
    }

    /**
     * AllSettled - все промисы завершены (включая rejected)
     */
    async allSettled(tasks) {
        if (tasks.length === 0) {
            return VladXObject.array([]);
        }

        const results = await Promise.allSettled(
            tasks.map(task =>
                Promise.race([
                    task(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), this.timeout)
                    )
                ])
            )
        );

        this.stats.total += tasks.length;
        return VladXObject.array(
            results.map(result => ({
                status: result.status,
                value: result.status === 'fulfilled' ? result.value : result.reason
            }))
        );
    }

    /**
     * Any - первый успешно завершившийся
     */
    async any(tasks) {
        if (tasks.length === 0) {
            throw new Error('Нет задач для выполнения');
        }

        try {
            const result = await Promise.any(
                tasks.map(task =>
                    Promise.race([
                        task(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Timeout')), this.timeout)
                        )
                    ])
                )
            );
            return VladXObject.fromJS(result);
        } catch (error) {
            this.stats.failed++;
            throw error;
        }
    }

    /**
     * Debounce - задержка выполнения
     */
    debounce(func, delay) {
        let timeoutId;

        return (...args) => {
            clearTimeout(timeoutId);
            return new Promise((resolve) => {
                timeoutId = setTimeout(() => {
                    resolve(func(...args));
                }, delay);
            });
        };
    }

    /**
     * Throttle - ограничение частоты выполнения
     */
    throttle(func, limit) {
        let inThrottle;

        return (...args) => {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Retry - повторная попытка при ошибке
     */
    async retry(func, maxAttempts = 3, delay = 1000) {
        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await func();
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        }

        throw lastError;
    }

    /**
     * Очистка активных промисов
     */
    clear() {
        this.activePromises.clear();
        this.queue = [];
    }

    /**
     * Получить статистику
     */
    getStats() {
        return {
            ...this.stats,
            active: this.activePromises.size,
            queued: this.queue.length
        };
    }
}

export default AsyncManager;
