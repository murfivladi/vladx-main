/**
 * Functional — Функциональное программирование
 */

import { VladXObject } from './vladx-object.js';

export class Functional {
    /**
     * Каррирование функции
     */
    static curry(fn) {
        return function curried(...args) {
            if (args.length >= fn.length) {
                return fn(...args);
            }
            return (...more) => curried(...args, ...more);
        };
    }

    /**
     * Композиция функций (справа налево)
     */
    static compose(...fns) {
        return (arg) => fns.reduceRight((acc, fn) => fn(acc), arg);
    }

    /**
     * Pipe оператор (слева направо)
     */
    static pipe(...fns) {
        return (arg) => fns.reduce((acc, fn) => fn(acc), arg);
    }

    /**
     * Мемоизация
     */
    static memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
        const cache = new Map();

        return (...args) => {
            const key = keyFn(...args);

            if (cache.has(key)) {
                return cache.get(key);
            }

            const result = fn(...args);
            cache.set(key, result);
            return result;
        };
    }

    /**
     * Частичное применение
     */
    static partial(fn, ...presetArgs) {
        return (...args) => fn(...presetArgs, ...args);
    }

    /**
     * Flip аргументы
     */
    static flip(fn) {
        return (...args) => fn(...args.reverse());
    }

    /**
     * Lazy evaluation
     */
    static lazy(fn) {
        let cached = null;
        let computed = false;

        return () => {
            if (!computed) {
                cached = fn();
                computed = true;
            }
            return cached;
        };
    }

    /**
     * Thunk - задержанное вычисление
     */
    static thunk(fn, ...args) {
        return () => fn(...args);
    }

    /**
     * Identity функция
     */
    static identity(x) {
        return x;
    }

    /**
     * Always возвращает всегда одно и то же значение
     */
    static always(x) {
        return () => x;
    }

    /**
     * Tap - побочный эффект
     */
    static tap(fn) {
        return (x) => {
            fn(x);
            return x;
        };
    }

    /**
     * Trace - отладочная функция
     */
    static trace(label = 'trace') {
        return (x) => {
            console.log(label, x);
            return x;
        };
    }

    /**
     * Apply - применить функцию к аргументам
     */
    static apply(fn, args) {
        return fn(...args);
    }

    /**
     * Uncurry - превращить метод в функцию
     */
    static uncurry(fn) {
        return (obj, ...args) => obj[fn](...args);
    }

    /**
     * Converge - применить функции к аргументам и передать результаты в другую функцию
     */
    static converge(after, fns) {
        return (...args) => after(...fns.map(fn => fn(...args)));
    }

    /**
     * Once - функция выполняется только один раз
     */
    static once(fn) {
        let called = false;
        let result;

        return (...args) => {
            if (called) return result;
            called = true;
            result = fn(...args);
            return result;
        };
    }

    /**
     * Debounce - задержка выполнения
     */
    static debounce(fn, delay) {
        let timeoutId;

        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    }

    /**
     * Throttle - ограничение частоты
     */
    static throttle(fn, limit) {
        let inThrottle;

        return (...args) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Maybe Monad
     */
    static Maybe(value) {
        return {
            isNothing: () => value === null || value === undefined,
            map: (fn) => Functional.Maybe(value === null || value === undefined ? null : fn(value)),
            chain: (fn) => Functional.Maybe(value === null || value === undefined ? null : fn(value)),
            getOrElse: (def) => value === null || value === undefined ? def : value,
            ap: (maybeFn) => Functional.Maybe(value === null || value === undefined ? null : maybeFn.getOrElse(null)(value)),
            join: () => Functional.Maybe(value === null || value === undefined ? null : value.getOrElse ? value.getOrElse(null) : value)
        };
    }

    /**
     * Either Monad
     */
    static Either(value) {
        return {
            isLeft: () => value instanceof Error,
            isRight: () => !(value instanceof Error),
            map: (fn) => Functional.Either(value instanceof Error ? value : fn(value)),
            chain: (fn) => Functional.Either(value instanceof Error ? value : fn(value)),
            getOrElse: (def) => value instanceof Error ? def : value,
            fold: (onLeft, onRight) => value instanceof Error ? onLeft(value) : onRight(value),
            ap: (eitherFn) => Functional.Either(
                value instanceof Error || eitherFn.isLeft() ? value : eitherFn.getOrElse(null)(value)
            )
        };
    }

    /**
     * Promise Monad
     */
    static PromiseMonad(value) {
        return Promise.resolve(value);
    }

    /**
     * Fold (reduce) - свертка
     */
    static fold(fn, initial) {
        return (arr) => arr.reduce(fn, initial);
    }

    /**
     * Unfold - развертка
     */
    static unfold(fn, seed) {
        const result = [];
        let current = seed;

        while (true) {
            const [value, next] = fn(current);
            if (value === undefined) break;
            result.push(value);
            current = next;
        }

        return result;
    }

    /**
     * Range - создание диапазона
     */
    static range(start, end, step = 1) {
        const result = [];

        for (let i = start; step > 0 ? i < end : i > end; i += step) {
            result.push(i);
        }

        return result;
    }

    /**
     * Zip - объединение массивов
     */
    static zip(...arrays) {
        const maxLength = Math.max(...arrays.map(a => a.length));
        const result = [];

        for (let i = 0; i < maxLength; i++) {
            result.push(arrays.map(a => a[i]));
        }

        return result;
    }

    /**
     * ZipWith - объединение с функцией
     */
    static zipWith(fn, ...arrays) {
        return Functional.zip(...arrays).map(tuple => fn(...tuple));
    }

    /**
     * Partition - разделение массива
     */
    static partition(fn) {
        return (arr) => arr.reduce(
            (acc, x) => (fn(x) ? (acc[0].push(x), acc) : (acc[1].push(x), acc)),
            [[], []]
        );
    }

    /**
     * GroupBy - группировка
     */
    static groupBy(fn) {
        return (arr) => arr.reduce((acc, x) => {
            const key = fn(x);
            (acc[key] = acc[key] || []).push(x);
            return acc;
        }, {});
    }

    /**
     * SortBy - сортировка по ключу
     */
    static sortBy(fn) {
        return (arr) => [...arr].sort((a, b) => {
            const fa = fn(a);
            const fb = fn(b);
            if (fa < fb) return -1;
            if (fa > fb) return 1;
            return 0;
        });
    }

    /**
     * Take - взять N элементов
     */
    static take(n) {
        return (arr) => arr.slice(0, n);
    }

    /**
     * TakeWhile - взять пока условие истинно
     */
    static takeWhile(fn) {
        return (arr) => {
            const result = [];
            for (const x of arr) {
                if (!fn(x)) break;
                result.push(x);
            }
            return result;
        };
    }

    /**
     * Drop - отбросить N элементов
     */
    static drop(n) {
        return (arr) => arr.slice(n);
    }

    /**
     * DropWhile - отбросить пока условие истинно
     */
    static dropWhile(fn) {
        return (arr) => {
            let index = 0;
            while (index < arr.length && fn(arr[index])) {
                index++;
            }
            return arr.slice(index);
        };
    }
}

export default Functional;
