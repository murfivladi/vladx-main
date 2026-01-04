/**
 * EventEmitter — Реализация события emitter
 */

export class EventEmitter {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Map();
        this.maxListeners = 10;
    }

    /**
     * Добавить listener
     */
    on(event, listener) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listeners = this.events.get(event);

        // Проверка на maxListeners
        if (listeners.length >= this.maxListeners) {
            console.warn(`Possible memory leak detected. ${listeners.length} ${event} listeners added.`);
        }

        listeners.push(listener);
        return this;
    }

    /**
     * Добавить one-time listener
     */
    once(event, listener) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            listener(...args);
        };

        this.on(event, wrapper);
        return this;
    }

    /**
     * Удалить listener
     */
    off(event, listener) {
        const listeners = this.events.get(event);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }

            if (listeners.length === 0) {
                this.events.delete(event);
            }
        }
        return this;
    }

    /**
     * Запустить событие
     */
    emit(event, ...args) {
        const listeners = this.events.get(event);
        if (listeners) {
            // Копируем массив для безопасной модификации во время итерации
            const listenersCopy = [...listeners];

            for (const listener of listenersCopy) {
                try {
                    listener(...args);
                } catch (error) {
                    // Ошибка в listener не должна прерывать других
                    console.error(`Error in ${event} listener:`, error);
                }
            }

            return listeners.length > 0;
        }
        return false;
    }

    /**
     * Добавить listener (синоним on)
     */
    addListener(event, listener) {
        return this.on(event, listener);
    }

    /**
     * Удалить listener (синоним off)
     */
    removeListener(event, listener) {
        return this.off(event, listener);
    }

    /**
     * Удалить все listeners для события
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
        return this;
    }

    /**
     * Получить listeners для события
     */
    listeners(event) {
        return this.events.get(event) || [];
    }

    /**
     * Получить количество listeners для события
     */
    listenerCount(event) {
        return (this.events.get(event) || []).length;
    }

    /**
     * Получить все имена событий
     */
    eventNames() {
        return Array.from(this.events.keys());
    }

    /**
     * Установить максимальное количество listeners
     */
    setMaxListeners(n) {
        this.maxListeners = n;
        return this;
    }

    /**
     * Получить максимальное количество listeners
     */
    getMaxListeners() {
        return this.maxListeners;
    }

    /**
     * Добавить prepend listener (добавляется в начало)
     */
    prependListener(event, listener) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        this.events.get(event).unshift(listener);
        return this;
    }

    /**
     * Добавить prepend once listener
     */
    prependOnceListener(event, listener) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            listener(...args);
        };

        this.prependListener(event, wrapper);
        return this;
    }

    /**
     * Статический метод для создания emitter
     */
    static create() {
        return new EventEmitter();
    }

    /**
     * Асинхронный emit (Promise)
     */
    async emitAsync(event, ...args) {
        const listeners = this.events.get(event);
        if (!listeners) {
            return false;
        }

        const results = [];

        for (const listener of listeners) {
            try {
                const result = listener(...args);
                if (result && typeof result.then === 'function') {
                    results.push(await result);
                } else {
                    results.push(result);
                }
            } catch (error) {
                console.error(`Error in ${event} async listener:`, error);
                results.push(Promise.reject(error));
            }
        }

        return results;
    }

    /**
     * Проверить, есть ли listeners
     */
    hasListeners(event) {
        return this.listenerCount(event) > 0;
    }

    /**
     * Получить информацию о памяти
     */
    getMemoryUsage() {
        let totalListeners = 0;

        for (const [event, listeners] of this.events) {
            totalListeners += listeners.length;
        }

        return {
            events: this.events.size,
            totalListeners,
            maxListeners: this.maxListeners
        };
    }
}

export default EventEmitter;
