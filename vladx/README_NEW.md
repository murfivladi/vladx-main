# VladX - Мощный интерпретируемый язык программирования

Полностью переписанный и значительно расширенный язык с русским синтаксисом.

## Что нового

### 🚀 Производительность

- **CacheManager** - LRU кэширование с TTL
- **OptimizedLexer** - оптимизированный лексер с кэшем regex
- **RegexCache** - кэширование регулярных выражений
- **JITCompiler** - компиляция в JavaScript

### 🔒 Безопасность

- **SecurityManager** - песочница и защита
- - Валидация путей (path traversal защита)
- - Проверка URL
- - Защита от prototype pollution
- - Ограничения файлов и памяти

### 🏗️ Система типов

- **AdvancedTypeSystem** - расширенная система типов
- - Union types (число|строка)
- - Intersection types
- - Generic types
- - Type aliases
- - Tuple types (пара, тройка)

### ⚡ Асинхронность

- **AsyncManager** - управление асинхронными операциями
- - Параллельное выполнение
- - Sequential выполнение
- - Race, AllSettled, Any
- - Debounce, Throttle, Retry

### 🧩 Модульная система

- **EnhancedModuleSystem** - улучшенная система модулей
- - Динамический импорт
- - Conditional exports
- - Re-exports
- - Граф зависимостей

### 🔧 Инструменты разработки

- **Debugger** - пошаговый отладчик
- - Breakpoints
- - Step into/over/out
- - Watch expressions
- - Call stack inspection

- **Profiler** - профилировщик производительности
- - Flame graphs
- - Hotspots detection
- - Memory profiling
- - Performance comparison

- **REPL** - интерактивная консоль
- - История команд
- - Tab completion
- - Специальные команды
- - Поддержка многострочного ввода

- **Linter** - линтер кода
- - Проверка переменных
- - Правила стиля
- - Автофикс
- - JUnit экспорт

- **Formatter** - форматировщик кода
- - Настраиваемый стиль
- - Автоформатирование
- - Проверка кода

### 📦 Сборка и оптимизация

- **Bundle** - сборщик модулей
- - ESM, CJS, IIFE, UMD форматы
- - Source maps
- - Tree shaking
- - Минификация

- **Minifier** - минификатор
- - Удаление комментариев
- - Обфускация имен
- - Dead code elimination

- **Transformer** - AST трансформации
- - Hoisting
- - Constant folding
- - Inline functions
- - Dead code removal

### 🔬 Тестирование

- **TestRunner** - тестовый фреймворк
- - describe/it
- - before/after hooks
- - Assertions
- - Snapshot testing
- - JUnit формат

### 🌐 I/O и сеть

- **IOOperations** - файловые операции
- - Streaming I/O
- - File watching
- - Path utilities
- - MIME types

- **NetworkOperations** - сетевые операции
- - HTTP/HTTPS запросы
- - File upload/download
- - WebSocket
- - Multipart forms

### 🧮 Функциональное программирование

- **Functional** - FP утилиты
- - curry, compose, pipe
- - memoize, partial, flip
- - Maybe, Either monads
- - Lazy evaluation

### 🏛️ Структуры данных

- **Stack** - стек
- **Queue** - очередь
- **LinkedList** - связный список
- **PriorityQueue** - приоритетная очередь
- **SetCustom** - множество
- **MapCustom** - карта
- **Trie** - префиксное дерево
- **BinarySearchTree** - бинарное дерево поиска

### 🎯 Другое

- **EnvironmentEnhanced** - управление окружением
- - Переменные окружения
- - Конфигурация
- - Plugins, middleware
- - Hooks

- **EventEmitter** - система событий
- - on/off/emit
- - once listeners
- - Async emit
- - Memory usage tracking

- **Logging** - система логирования
- - Уровни (debug, info, warn, error)
- - Форматы (text, json)
- - File rotation
- - Child loggers

- **SourceMapGenerator** - генерация source maps
- VLQ кодирование
- Маппинг позиций

## Использование

### Базовый пример

```javascript
import { VladXEngine } from 'vladx';

const engine = new VladXEngine();
const result = await engine.execute('пусть x = 10 + 5');
console.log(result); // 15
```

### С кэшированием

```javascript
import { VladXEngine } from 'vladx';

const engine = new VladXEngine({
    cache: {
        maxSize: 1000,
        ttl: 300000
    }
});

const result = await engine.execute('кэшУстановить("ключ", "значение")');
```

### С безопасностью

```javascript
import { VladXEngine } from 'vladx';

const engine = new VladXEngine({
    security: {
        enabled: true,
        allowedPaths: ['/safe'],
        maxFileSize: 1024 * 1024
    }
});
```

### С отладчиком

```javascript
import { VladXEngine } from 'vladx';

const engine = new VladXEngine();

engine.debugger.setBreakpoint('file.vx', 10);
engine.debugger.stepInto();

const result = await engine.execute(code);
```

### С профилированием

```javascript
import { VladXEngine } from 'vladx';

const engine = new VladXEngine();

engine.profiler.start();
await engine.execute(code);
const results = engine.profiler.stop();

console.log(results.functions);
console.log(results.hotspots);
```

### С форматированием

```javascript
import { Formatter } from 'vladx';

const formatter = new Formatter({
    indentSize: 4,
    useTabs: false
});

const formatted = formatter.format(source);
```

### С линтингом

```javascript
import { Linter } from 'vladx';

const linter = new Linter({
    config: {
        maxLineLength: 100
    },
    autoFix: true
});

const results = linter.lint(source);
const fixed = linter.fix(source);
```

### С тестированием

```javascript
import { TestRunner } from 'vladx';

const runner = new TestRunner();

runner.describe('Математика', () => {
    runner.it('сложение', () => {
        const result = 2 + 2;
        runner.assertions.equal(result, 4);
    });

    runner.it('умножение', () => {
        const result = 5 * 5;
        runner.assertions.equal(result, 25);
    });
});

await runner.run();
```

### Функциональное программирование

```javascript
import { Functional } from 'vladx';

const add = (a, b) => a + b;
const curried = Functional.curry(add);
const add5 = curried(5);

console.log(add5(3)); // 8

const composed = Functional.compose(
    x => x * 2,
    x => x + 1,
    x => Math.sqrt(x)
);

console.log(composed(9)); // 5
```

### Структуры данных

```javascript
import DataStructures from 'vladx';

const stack = new DataStructures.Stack();
stack.push(1);
stack.push(2);
console.log(stack.pop()); // 2

const queue = new DataStructures.Queue();
queue.enqueue(1);
queue.enqueue(2);
console.log(queue.dequeue()); // 1
```

### Асинхронные операции

```javascript
import { VladXEngine } from 'vladx';

const engine = new VladXEngine();

const tasks = [
    () => fetch('/api/1'),
    () => fetch('/api/2'),
    () => fetch('/api/3')
];

const results = await engine.interpreter.asyncManager.parallel(tasks);
```

## Встроенные функции

### Кэш

- `кэшПолучить(key)` - получить из кэша
- `кэшУстановить(key, value)` - установить в кэш
- `кэшУдалить(key)` - удалить из кэша
- `кэшОчистить()` - очистить кэш
- `кэшСтатистика()` - получить статистику

### Безопасность

- `проверитьПуть(path)` - проверить путь
- `проверитьURL(url)` - проверить URL
- `санитизировать(data)` - санитизировать данные
- `экранироватьHTML(str)` - экранировать HTML

### Отладка

- `точкаОстанова(filename, line)` - установить breakpoint
- `удалитьТочкуОстанова(filename, line)` - удалить breakpoint
- `пошаговыйРежим()` - включить пошаговый режим
- `продолжить()` - продолжить выполнение
- `стекВызовов()` - получить стек вызовов

### Профилирование

- `стартПрофилирования()` - начать профилирование
- `стопПрофилирования()` - остановить профилирование
- `результатыПрофилирования()` - получить результаты

### Функциональное

- `каррировать(fn)` - каррирование
- `композиция(...fns)` - композиция
- `труба(...fns)` - pipe оператор
- `мемоизировать(fn)` - мемоизация
- `частично(fn, ...args)` - частичное применение
- `инвертировать(fn)` - flip
- `одинРаз(fn)` - once

### Структуры данных

- `Стек()` - создать стек
- `Очередь()` - создать очередь
- `СвязныйСписок()` - создать связный список
- `ПриоритетнаяОчередь(comparator)` - создать приоритетную очередь
- `Множество()` - создать множество
- `Карта()` - создать карту
- `Дерево()` - создать trie
- `БинарноеДерево(compareFn)` - создать бинарное дерево

### I/O

- `файлПрочитатьПоток(path, options)` - прочитать файл потоком
- `файлЗаписатьПоток(path, content, options)` - записать файл потоком
- `файлИнформация(path)` - получить информацию о файле
- `директорияПрочитать(path, options)` - прочитать директорию
- `директорияСоздать(path, options)` - создать директорию
- `файлУдалить(path)` - удалить файл
- `директорияУдалить(path, options)` - удалить директорию
- `файлКопировать(src, dest)` - копировать файл
- `файлПереместить(src, dest)` - переместить файл
- `смотретьФайл(path, callback, options)` - смотреть за файлом
- `найтиФайлы(path, pattern, options)` - найти файлы
- `размерДиректории(path)` - получить размер директории
- `mimeТип(path)` - получить MIME тип

### Сеть

- `httpGet(url, options)` - HTTP GET
- `httpPost(url, data, options)` - HTTP POST
- `httpPut(url, data, options)` - HTTP PUT
- `httpDelete(url, options)` - HTTP DELETE
- `httpPatch(url, data, options)` - HTTP PATCH
- `httpЗапрос(url, options)` - общий HTTP запрос
- `скачатьФайл(url, destPath)` - скачать файл
- `загрузитьФайл(url, filePath, options)` - загрузить файл
- `проверитьURL(url)` - проверить доступность URL
- `multipartForm()` - создать multipart form

## Конфигурация

```javascript
const engine = new VladXEngine({
    debug: false,              // Режим отладки
    strictMode: false,         // Строгий режим
    maxExecutionTime: 30000,   // Максимальное время выполнения (мс)
    cache: {
        maxSize: 1000,        // Размер кэша
        ttl: 300000           // TTL кэша (мс)
    },
    security: {
        enabled: true,        // Включить безопасность
        allowedPaths: [],      // Разрешенные пути
        maxFileSize: 10485760  // Максимальный размер файла
    }
});
```

## Лицензия

MIT
