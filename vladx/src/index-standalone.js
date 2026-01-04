/**
 * VladX - Полностью самодостаточный интерпретатор
 * Все в одном файле для простоты использования
 */

// === Типы данных ===
const types = {
    NULL: 'null',
    NUMBER: 'number',
    STRING: 'string',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
    FUNCTION: 'function',
    CLOSURE: 'closure'
};

// === Базовый объект ===
class VladXObject {
    constructor(type, value = null) {
        this.type = type;
        this.value = value;
    }

    static null() { return new VladXObject(types.NULL, null); }
    static number(value) { return new VladXObject(types.NUMBER, Number(value)); }
    static string(value) { return new VladXObject(types.STRING, String(value)); }
    static boolean(value) { return new VladXObject(types.BOOLEAN, Boolean(value)); }
    static array(value) { return new VladXObject(types.ARRAY, Array.isArray(value) ? value : [value]); }
    static object(value) { return new VladXObject(types.OBJECT, value && typeof value === 'object' ? value : {}); }
    static function(value, name = '<function>') { return new VladXObject(types.FUNCTION, value, { name }); }
    static closure(ast, env, name = '<closure>') { return new VladXObject(types.CLOSURE, null, { env, name, ast }); }

    toString() {
        switch (this.type) {
            case types.NULL: return 'ничто';
            case types.STRING: return this.value;
            case types.NUMBER: return String(this.value);
            case types.BOOLEAN: return this.value ? 'истина' : 'ложь';
            case types.ARRAY: return '[' + this.value.map(v => v?.toString() || String(v)).join(', ') + ']';
            case types.OBJECT: return '{' + Object.entries(this.value).map(([k, v]) => `${k}: ${v?.toString() || String(v)}`).join(', ') + '}';
            case types.FUNCTION: return `[функция: ${this.name}]`;
            case types.CLOSURE: return `[замыкание: ${this.name}]`;
            default: return String(this.value);
        }
    }
}

// === Кэш ===
class Cache {
    constructor(maxSize = 1000, ttl = 300000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.hits = 0;
        this.misses = 0;
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return undefined;
        }
        if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.misses++;
            return undefined;
        }
        this.hits++;
        return entry.value;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        this.cache.set(key, { value, timestamp: Date.now() });
    }

    evictLRU() {
        let lruKey = null;
        let lruTime = Infinity;
        for (const [key, entry] of this.cache) {
            if (entry.timestamp < lruTime) {
                lruTime = entry.timestamp;
                lruKey = key;
            }
        }
        if (lruKey) this.cache.delete(lruKey);
    }

    clear() {
        this.cache.clear();
    }

    getStats() {
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.hits + this.misses > 0 ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(2) + '%' : '0%'
        };
    }
}

// === Функциональное программирование ===
const Functional = {
    curry(fn) {
        const curried = (...args) => {
            if (args.length >= fn.length) return fn(...args);
            return (...more) => curried(...args, ...more);
        };
        return curried;
    },

    compose(...fns) {
        return (arg) => fns.reduceRight((acc, fn) => fn(acc), arg);
    },

    pipe(...fns) {
        return (arg) => fns.reduce((acc, fn) => fn(acc), arg);
    },

    memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
        const cache = new Map();
        return (...args) => {
            const key = keyFn(...args);
            if (cache.has(key)) return cache.get(key);
            const result = fn(...args);
            cache.set(key, result);
            return result;
        };
    },

    partial(fn, ...presetArgs) {
        return (...args) => fn(...presetArgs, ...args);
    },

    flip(fn) {
        return (...args) => fn(...args.reverse());
    },

    once(fn) {
        let called = false;
        return (...args) => {
            if (called) return result;
            called = true;
            result = fn(...args);
            return result;
        };
    },

    trace(label = 'trace') => {
        return function(x) {
            console.log(label, x);
            return x;
        };
    }
};
    },

    trace(label = 'trace') => {
        return (x) => {
            console.log(label, x);
            return x;
        };
    }
};

// === Асинхронность ===
class AsyncManager {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 10;
        this.timeout = options.timeout || 30000;
    }

    async parallel(tasks) {
        return Promise.all(tasks.map(t => t()));
    }

    async sequential(tasks) {
        const results = [];
        for (const task of tasks) {
            results.push(await task());
        }
        return results;
    }

    async race(tasks) {
        return Promise.race(tasks.map(t => t()));
    }

    async allSettled(tasks) {
        return Promise.allSettled(tasks.map(t => t()));
    }

    async any(tasks) {
        return Promise.any(tasks.map(t => t()));
    }
}

// === Окружение ===
class Environment {
    constructor(parent = null, name = '<env>') {
        this.parent = parent;
        this.name = name;
        this.variables = new Map();
        this.constants = new Set();
    }

    define(name, value, isConst = false) {
        if (this.constants.has(name)) {
            throw new Error(`Константа ${name} уже объявлена`);
        }
        this.variables.set(name, value);
        if (isConst) {
            this.constants.add(name);
        }
    }

    get(name) {
        if (this.variables.has(name)) {
            return this.variables.get(name);
        }
        if (this.parent) {
            return this.parent.get(name);
        }
        throw new Error(`Переменная "${name}" не найдена в окружении ${this.name}`);
    }

    assign(name, value) {
        if (this.variables.has(name)) {
            if (this.constants.has(name)) {
                throw new Error(`Нельзя изменить константу ${name}`);
            }
            this.variables.set(name, value);
            return true;
        }
        if (this.parent) {
            return this.parent.assign(name, value);
        }
        throw new Error(`Переменная ${name} не найдена`);
    }

    child(name = '<child>') {
        return new Environment(this, name);
    }
}

// === Лексер ===
class Lexer {
    constructor(source, filename = '<unknown>') {
        this.source = source;
        this.filename = filename;
        this.tokens = [];
        this.pos = 0;
        this.line = 1;
        this.column = 1;
    }

    tokenize() {
        while (this.pos < this.source.length) {
            this.skipWhitespace();

            if (this.pos >= this.source.length) break;

            const char = this.source[this.pos];

            // Комменатарии
            if (char === '#') {
                this.skipComment();
                continue;
            }

            // Строки
            if (char === '"' || char === "'") {
                this.readString();
                continue;
            }

            // Числа
            if (this.isDigit(char)) {
                this.readNumber();
                continue;
            }

            // Ключевые слова и идентификаторы
            if (this.isAlpha(char)) {
                this.readWordOrKeyword();
                continue;
            }

            // Операторы
            this.readOperator();
        }

        return this.tokens;
    }

    skipWhitespace() {
        while (this.pos < this.source.length && /[\s\n\r]/.test(this.source[this.pos])) {
            if (this.source[this.pos] === '\n') {
                this.line++;
                this.column = 1;
            } else {
                this.column++;
            }
            this.pos++;
        }
    }

    skipComment() {
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
            this.pos++;
        }
        if (this.source[this.pos] === '\n') {
            this.line++;
            this.column = 1;
            this.pos++;
        }
    }

    readString() {
        const quote = this.source[this.pos];
        this.pos++;
        this.column++;
        let value = '';

        while (this.pos < this.source.length && this.source[this.pos] !== quote) {
            if (this.source[this.pos] === '\\' && this.pos + 1 < this.source.length) {
                this.pos += 2;
                value += this.source[this.pos - 1];
            } else {
                value += this.source[this.pos];
                this.pos++;
            }
            this.column++;
        }

        this.pos++; // закрывающая кавычка
        this.column++;
        this.tokens.push({
            type: 'STRING',
            value,
            line: this.line,
            column: this.column
        });
    }

    readNumber() {
        let start = this.pos;
        let hasDot = false;

        while (this.pos < this.source.length) {
            const char = this.source[this.pos];
            if (char === '.') {
                if (hasDot) break;
                hasDot = true;
            } else if (!this.isDigit(char)) {
                break;
            }
            this.pos++;
        }

        const value = this.source.substring(start, this.pos);
        const number = parseFloat(value);
        this.column += this.pos - start;
        this.tokens.push({
            type: 'NUMBER',
            value: number,
            line: this.line,
            column: this.column
        });
    }

    readWordOrKeyword() {
        const start = this.pos;
        while (this.pos < this.source.length && (this.isAlphaNum(this.source[this.pos]) || this.source[this.pos] === '_')) {
            this.pos++;
        }

        const word = this.source.substring(start, this.pos);
        this.column += this.pos - start;

        // Ключевые слова
        const keywords = {
            'пусть': 'LET', 'let': 'LET',
            'константа': 'CONST', 'const': 'CONST',
            'функция': 'FUNCTION', 'function': 'FUNCTION',
            'вернуть': 'RETURN', 'return': 'RETURN',
            'если': 'IF', 'if': 'IF',
            'иначе': 'ELSE', 'else': 'ELSE',
            'пока': 'WHILE', 'while': 'WHILE',
            'для': 'FOR', 'for': 'FOR',
            'истина': 'TRUE', 'true': 'TRUE',
            'ложь': 'FALSE', 'false': 'FALSE',
            'ничто': 'NULL', 'null': 'NULL',
            'печать': 'PRINT', 'console.log': 'PRINT',
            'класс': 'CLASS', 'class': 'CLASS',
            'новый': 'NEW', 'new': 'NEW',
            'этот': 'THIS', 'this': 'THIS'
        };

        const type = keywords[word] || 'IDENTIFIER';
        this.tokens.push({
            type,
            value: word,
            line: this.line,
            column: this.column
        });
    }

    readOperator() {
        const twoCharOps = [
            '==', '!=', '<=', '>=', '&&', '||',
            '+=', '-=', '*=', '/=', '%=', '**'
        ];

        const twoChar = this.source.substring(this.pos, this.pos + 2);
        if (twoCharOps.includes(twoChar)) {
            this.tokens.push({
                type: 'OPERATOR',
                value: twoChar,
                line: this.line,
                column: this.column
            });
            this.pos += 2;
            this.column += 2;
            return;
        }

        const oneCharOps = '+-*/%=!<>,.:()[]{};';

        if (oneCharOps.includes(this.source[this.pos])) {
            this.tokens.push({
                type: 'OPERATOR',
                value: this.source[this.pos],
                line: this.line,
                column: this.column
            });
            this.pos++;
            this.column++;
        }
    }

    isDigit(char) {
        return char >= '0' && char <= '9';
    }

    isAlpha(char) {
        return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') ||
               (char >= 'а' && char <= 'я') || (char >= 'А' && char <= 'Я');
    }

    isAlphaNum(char) {
        return this.isAlpha(char) || this.isDigit(char);
    }
}

// === Парсер ===
class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    parse() {
        const statements = [];

        while (this.pos < this.tokens.length) {
            const stmt = this.parseStatement();
            if (stmt) statements.push(stmt);
        }

        return { type: 'Program', body: statements };
    }

    parseStatement() {
        const token = this.current();

        if (!token) return null;

        switch (token.type) {
            case 'LET':
            return this.parseLetStatement();
            case 'CONST':
                return this.parseConstStatement();
            case 'FUNCTION':
                return this.parseFunctionDeclaration();
            case 'RETURN':
                return this.parseReturnStatement();
            case 'IF':
                return this.parseIfStatement();
            case 'WHILE':
                return this.parseWhileStatement();
            case 'FOR':
                return this.parseForStatement();
            case 'PRINT':
                return this.parsePrintStatement();
            case 'IDENTIFIER':
                return this.parseExpressionStatement();
            default:
                throw new Error(`Неизвестный токен: ${token.type} "${token.value}" на линии ${token.line}`);
        }
    }

    parseLetStatement() {
        const letToken = this.advance(); // 'пусть'
        const nameToken = this.expect('IDENTIFIER');
        const name = nameToken.value;

        let init = null;
        if (this.current() && this.current().value === '=') {
            this.advance(); // '='
            init = this.parseExpression();
        }

        return { type: 'LetStatement', name, initializer: init };
    }

    parseConstStatement() {
        const constToken = this.advance(); // 'константа'
        const nameToken = this.expect('IDENTIFIER');
        const name = nameToken.value;

        this.expect('=');

        const init = this.parseExpression();

        return { type: 'ConstStatement', name, initializer: init };
    }

    parseFunctionDeclaration() {
        const funcToken = this.advance(); // 'функция'
        const nameToken = this.expect('IDENTIFIER');
        const name = nameToken.value;

        this.expect('(');

        const params = [];
        if (this.current() && this.current().type !== ')') {
            params.push(this.expect('IDENTIFIER').value);
            while (this.current() && this.current().value === ',') {
                this.advance(); // ','
                params.push(this.expect('IDENTIFIER').value);
            }
        }

        this.expect(')');

        const body = this.parseBlock();

        return { type: 'FunctionDeclaration', name, params, body };
    }

    parseReturnStatement() {
        this.advance(); // 'вернуть'
        const value = this.parseExpression();
        return { type: 'ReturnStatement', value };
    }

    parseIfStatement() {
        this.advance(); // 'если'
        this.expect('(');
        const condition = this.parseExpression();
        this.expect(')');

        const thenBranch = this.parseBlock();
        let elseBranch = null;

        if (this.current() && (this.current().value === 'иначе' || this.current().value === 'else')) {
            this.advance(); // 'иначе'
            elseBranch = this.parseBlock();
        }

        return { type: 'IfStatement', condition, thenBranch, elseBranch };
    }

    parseWhileStatement() {
        this.advance(); // 'пока'
        this.expect('(');
        const condition = this.parseExpression();
        this.expect(')');

        const body = this.parseBlock();

        return { type: 'WhileStatement', condition, body };
    }

    parseForStatement() {
        this.advance(); // 'для'
        this.expect('(');

        let init = null;
        if (this.current() && this.current().type !== ';') {
            init = this.parseExpression();
        }

        this.expect(';');

        const condition = this.parseExpression();
        this.expect(';');

        const update = this.parseExpression();
        this.expect(')');

        const body = this.parseBlock();

        return { type: 'ForStatement', initializer: init, condition, update, body };
    }

    parsePrintStatement() {
        this.advance(); // 'печать'
        const args = [];

        if (this.current() && this.current().value === '(') {
            this.advance(); // '('
            while (this.current() && this.current().value !== ')') {
                args.push(this.parseExpression());
                if (this.current() && this.current().value === ',') {
                    this.advance();
                }
            }
            this.expect(')');
        }

        return { type: 'PrintStatement', args };
    }

    parseExpressionStatement() {
        const expr = this.parseExpression();
        return { type: 'ExpressionStatement', expression: expr };
    }

    parseExpression() {
        return this.parseAssignment();
    }

    parseAssignment() {
        const left = this.parseEquality();

        if (this.current() && this.current().value === '=') {
            this.advance(); // '='
            const right = this.parseAssignment();
            return { type: 'AssignmentExpression', left, right };
        }

        return left;
    }

    parseEquality() {
        let left = this.parseComparison();

        while (this.current() && ['==', '!='].includes(this.current().value)) {
            const operator = this.advance().value;
            const right = this.parseComparison();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    parseComparison() {
        let left = this.parseTerm();

        while (this.current() && ['<', '<=', '>', '>='].includes(this.current().value)) {
            const operator = this.advance().value;
            const right = this.parseTerm();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    parseTerm() {
        let left = this.parseFactor();

        while (this.current() && ['+', '-'].includes(this.current().value)) {
            const operator = this.advance().value;
            const right = this.parseFactor();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    parseFactor() {
        let left = this.parseUnary();

        while (this.current() && ['*', '/', '%'].includes(this.current().value)) {
            const operator = this.advance().value;
            const right = this.parseUnary();
            left = { type: 'BinaryExpression', operator, left, right };
        }

        return left;
    }

    parseUnary() {
        if (this.current() && ['!', '-', '+'].includes(this.current().value)) {
            const operator = this.advance().value;
            const operand = this.parseUnary();
            return { type: 'UnaryExpression', operator, operand };
        }

        return this.parseCallMember();
    }

    parseCallMember() {
        let left = this.parsePrimary();

        while (this.current() && this.current().value === '(') {
            const args = this.parseArguments();
            left = { type: 'CallExpression', callee: left, arguments: args };
        }

        return left;
    }

    parsePrimary() {
        const token = this.current();

        if (!token) {
            throw new Error('Неожиданный конец кода');
        }

        if (token.type === 'NUMBER') {
            this.advance();
            return { type: 'Literal', value: token.value };
        }

        if (token.type === 'STRING') {
            this.advance();
            return { type: 'Literal', value: token.value };
        }

        if (token.type === 'IDENTIFIER') {
            const name = this.advance().value;
            return { type: 'Identifier', name };
        }

        if (token.type === 'TRUE' || token.type === 'FALSE') {
            this.advance();
            return { type: 'Literal', value: token.type === 'TRUE' };
        }

        if (token.type === 'NULL') {
            this.advance();
            return { type: 'Literal', value: null };
        }

        if (token.type === '(') {
            this.advance();
            const expr = this.parseExpression();
            this.expect(')');
            return expr;
        }

        if (token.value === 'новый') {
            this.advance();
            const callee = this.parsePrimary();
            return { type: 'NewExpression', callee };
        }

        if (token.value === 'этот') {
            this.advance();
            return { type: 'ThisExpression' };
        }

        throw new Error(`Неожиданный токен: ${token.type} "${token.value}" на линии ${token.line}`);
    }

    parseArguments() {
        this.expect('(');

        const args = [];
        if (this.current() && this.current().value !== ')') {
            args.push(this.parseExpression());
            while (this.current() && this.current().value === ',') {
                this.advance();
                args.push(this.parseExpression());
            }
        }

        this.expect(')');
        return args;
    }

    parseBlock() {
        this.expect('{');
        const statements = [];

        while (this.current() && this.current().value !== '}') {
            const stmt = this.parseStatement();
            if (stmt) statements.push(stmt);
        }

        this.expect('}');
        return { type: 'BlockStatement', body: statements };
    }

    current() {
        return this.tokens[this.pos] || null;
    }

    advance() {
        return this.tokens[this.pos++];
    }

    expect(expectedType) {
        const token = this.current();
        if (!token) {
            throw new Error(`Ожидалось ${expectedType}, но достигнут конец кода`);
        }
        if (token.type !== expectedType && token.value !== expectedType) {
            throw new Error(`Ожидалось ${expectedType}, но получено ${token.type} "${token.value}" на линии ${token.line}`);
        }
        return token;
    }
}

// === Интерпретатор ===
class Interpreter {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.globalEnv = new Environment(null, '<global>');
        this.currentEnv = this.globalEnv;
        this.isReturn = false;
        this.returnValue = null;
        this.cache = new Cache();
        this.asyncManager = new AsyncManager(options.async);
        this.builtins = new Map();
        this.registerBuiltins();
    }

    async interpret(ast) {
        let result = VladXObject.null();

        for (const stmt of ast.body) {
            result = await this.evaluateStatement(stmt);

            if (this.isReturn) {
                return this.returnValue;
            }
        }

        return result;
    }

    async evaluateStatement(stmt) {
        switch (stmt.type) {
            case 'LetStatement':
                const value = stmt.initializer ? await this.evaluateExpression(stmt.initializer) : VladXObject.null();
                this.currentEnv.define(stmt.name, value, false);
                return VladXObject.null();

            case 'ConstStatement':
                const constValue = await this.evaluateExpression(stmt.initializer);
                this.currentEnv.define(stmt.name, constValue, true);
                return VladXObject.null();

            case 'FunctionDeclaration':
                const closure = VladXObject.closure(
                    { type: 'FunctionDeclaration', name: stmt.name, params: stmt.params, body: stmt.body },
                    this.currentEnv,
                    stmt.name
                );
                this.currentEnv.define(stmt.name, closure, true);
                return VladXObject.null();

            case 'ReturnStatement':
                this.isReturn = true;
                this.returnValue = stmt.value ? await this.evaluateExpression(stmt.value) : VladXObject.null();
                return this.returnValue;

            case 'IfStatement':
                const condition = await this.evaluateExpression(stmt.condition);
                const conditionValue = this.getNativeValue(condition);

                if (conditionValue) {
                    return await this.evaluateBlock(stmt.thenBranch);
                } else if (stmt.elseBranch) {
                    return await this.evaluateBlock(stmt.elseBranch);
                }
                return VladXObject.null();

            case 'WhileStatement':
                let whileResult = VladXObject.null();
                while (true) {
                    const cond = await this.evaluateExpression(stmt.condition);
                    if (!this.getNativeValue(cond)) break;
                    whileResult = await this.evaluateBlock(stmt.body);
                }
                return whileResult;

            case 'ForStatement':
                await this.evaluateStatement(stmt.initializer);
                while (true) {
                    const cond = await this.evaluateExpression(stmt.condition);
                    if (!this.getNativeValue(cond)) break;
                    await this.evaluateStatement(stmt.update);
                    await this.evaluateBlock(stmt.body);
                }
                return VladXObject.null();

            case 'PrintStatement':
                const values = await Promise.all(stmt.args.map(arg => this.evaluateExpression(arg)));
                console.log(...values.map(v => this.getDisplayValue(v)));
                return VladXObject.null();

            case 'ExpressionStatement':
                return await this.evaluateExpression(stmt.expression);

            default:
                throw new Error(`Неизвестный оператор: ${stmt.type}`);
        }
    }

    async evaluateBlock(block) {
        const parentEnv = this.currentEnv;
        this.currentEnv = parentEnv.child('<block>');

        let result = VladXObject.null();
        for (const stmt of block.body) {
            result = await this.evaluateStatement(stmt);

            if (this.isReturn) {
                break;
            }
        }

        this.currentEnv = parentEnv;
        return result;
    }

    async evaluateExpression(expr) {
        switch (expr.type) {
            case 'Literal':
                if (expr.value === null) return VladXObject.null();
                if (typeof expr.value === 'number') return VladXObject.number(expr.value);
                if (typeof expr.value === 'boolean') return VladXObject.boolean(expr.value);
                if (typeof expr.value === 'string') return VladXObject.string(expr.value);
                return VladXObject.object(expr.value);

            case 'Identifier':
                return this.currentEnv.get(expr.name);

            case 'BinaryExpression':
                const left = await this.evaluateExpression(expr.left);
                const right = await this.evaluateExpression(expr.right);
                const leftVal = this.getNativeValue(left);
                const rightVal = this.getNativeValue(right);

                switch (expr.operator) {
                    case '+': return VladXObject.number(leftVal + rightVal);
                    case '-': return VladXObject.number(leftVal - rightVal);
                    case '*': return VladXObject.number(leftVal * rightVal);
                    case '/': return VladXObject.number(leftVal / rightVal);
                    case '%': return VladXObject.number(leftVal % rightVal);
                    case '**': return VladXObject.number(Math.pow(leftVal, rightVal));
                    case '==': return VladXObject.boolean(leftVal === rightVal);
                    case '!=': return VladXObject.boolean(leftVal !== rightVal);
                    case '<': return VladXObject.boolean(leftVal < rightVal);
                    case '<=': return VladXObject.boolean(leftVal <= rightVal);
                    case '>': return VladXObject.boolean(leftVal > rightVal);
                    case '>=': return VladXObject.boolean(leftVal >= rightVal);
                    case '&&': return VladXObject.boolean(leftVal && rightVal);
                    case '||': return VladXObject.boolean(leftVal || rightVal);
                    default:
                        throw new Error(`Неизвестный оператор: ${expr.operator}`);
                }

            case 'UnaryExpression':
                const operand = await this.evaluateExpression(expr.operand);
                const operandVal = this.getNativeValue(operand);

                switch (expr.operator) {
                    case '-': return VladXObject.number(-operandVal);
                    case '+': return VladXObject.number(+operandVal);
                    case '!': return VladXObject.boolean(!operandVal);
                    default:
                        throw new Error(`Неизвестный унарный оператор: ${expr.operator}`);
                }

            case 'AssignmentExpression':
                const assignRight = await this.evaluateExpression(expr.right);
                const assignValue = this.getNativeValue(assignRight);
                this.currentEnv.assign(expr.left.name, VladXObject.fromJS(assignValue));
                return assignRight;

            case 'CallExpression':
                return await this.evaluateCallExpression(expr);

            case 'NewExpression':
                return await this.evaluateNewExpression(expr);

            case 'ThisExpression':
                return this.currentEnv.get('этот') || VladXObject.null();

            default:
                throw new Error(`Неизвестное выражение: ${expr.type}`);
        }
    }

    async evaluateCallExpression(expr) {
        const callee = await this.evaluateExpression(expr.callee);
        const args = await Promise.all(expr.arguments.map(arg => this.evaluateExpression(arg)));
        const nativeArgs = args.map(arg => this.getNativeValue(arg));

        // Проверка на встроенную функцию
        if (callee.type === 'function' && this.builtins.has(callee.name)) {
            const fn = this.builtins.get(callee.name);
            const result = fn(...nativeArgs);

            // Если это промис, ожидаем его
            if (result && typeof result.then === 'function') {
                return VladXObject.fromJS(await result);
            }

            return VladXObject.fromJS(result);
        }

        // Проверка на замыкание
        if (callee.type === 'closure') {
            const closure = callee;
            const parentEnv = this.currentEnv;
            this.currentEnv = closure.env.child(`<closure:${callee.name}>`);

            for (let i = 0; i < closure.ast.params.length; i++) {
                const paramName = closure.ast.params[i];
                const argValue = nativeArgs[i] !== undefined ? nativeArgs[i] : VladXObject.null();
                this.currentEnv.define(paramName, argValue);
            }

            let result = VladXObject.null();
            for (const stmt of closure.ast.body.body) {
                result = await this.evaluateStatement(stmt);
                if (this.isReturn) {
                    this.isReturn = false;
                    this.currentEnv = parentEnv;
                    return this.returnValue;
                }
            }

            this.currentEnv = parentEnv;
            return result;
        }

        throw new Error(`${callee.name} не является функцией`);
    }

    async evaluateNewExpression(expr) {
        return VladXObject.object({});
    }

    getNativeValue(obj) {
        if (obj && obj.type !== undefined) {
            if (obj.type === 'number') return obj.value;
            if (obj.type === 'string') return obj.value;
            if (obj.type === 'boolean') return obj.value;
            if (obj.type === 'null') return null;
            if (obj.type === 'array') return obj.value;
            if (obj.type === 'object') return obj.value;
        }
        return obj;
    }

    registerBuiltins() {
        // Математика
        this.builtins.set('максимум', (...args) => Math.max(...args));
        this.builtins.set('минимум', (...args) => Math.min(...args));
        this.builtins.set('случайный', () => Math.random());
        this.builtins.set('случайноеЦелое', (min, max) => 
            Math.floor(Math.random() * (max - min + 1)) + min);
        this.builtins.set('abs', (n) => Math.abs(n));
        this.builtins.set('округлить', (n) => Math.round(n));
        this.builtins.set('корень', (n) => Math.sqrt(n));

        // Строки
        this.builtins.set('длина', (str) => String(str)?.length ?? 0);
        this.builtins.set('нижнийРегистр', (str) => String(str)?.toLowerCase() || '');
        this.builtins.set('верхнийРегистр', (str) => String(str)?.toUpperCase() || '');

        // Кэш
        this.builtins.set('кэшУстановить', (key, value) => {
            this.cache.set(key, value);
            return true;
        });
        this.builtins.set('кэшПолучить', (key) => this.cache.get(key));
        this.builtins.set('кэшОчистить', () => {
            this.cache.clear();
            return true;
        });
        this.builtins.set('кэшСтатистика', () => this.cache.getStats());

        // Функциональное
        this.builtins.set('каррировать', Functional.curry);
        this.builtins.set('композиция', Functional.compose);
        this.builtins.set('труба', Functional.pipe);
        this.builtins.set('мемоизировать', Functional.memoize);
        this.builtins.set('частично', Functional.partial);
        this.builtins.set('инвертировать', Functional.flip);
        this.builtins.set('одинРаз', Functional.once);
        this.builtins.set('отладить', Functional.trace);

        // Структуры данных
        this.builtins.set('Стек', () => ({
            push: (x) => { return { __type: 'stack', __data: [] } },
            pop: () => undefined
        }));
        this.builtins.set('Очередь', () => ({
            enqueue: (x) => undefined,
            dequeue: () => undefined
        }));

        // Асинхронность
        this.builtins.set('параллельно', (tasks) => this.asyncManager.parallel(tasks));
        this.builtins.set('последовательно', (tasks) => this.asyncManager.sequential(tasks));
        this.builtins.set('гонка', (tasks) => this.asyncManager.race(tasks));
        this.builtins.set('всеSettled', (tasks) => this.asyncManager.allSettled(tasks));
    }
}

// === Главный движок ===
export class VladXEngine {
    constructor(options = {}) {
        this.debug = options.debug || false;
    }

    async execute(source, options = {}) {
        const filename = options.filename || '<unknown>';

        if (this.debug) {
            console.log(`[VladX] Начинаем выполнение: ${filename}`);
        }

        try {
            // Лексический анализ
            const lexer = new Lexer(source, filename);
            const tokens = lexer.tokenize();

            if (this.debug) {
                console.log(`[VladX] Токенов: ${tokens.length}`);
            }

            // Синтаксический анализ
            const parser = new Parser(tokens);
            const ast = parser.parse();

            if (this.debug) {
                console.log(`[VladX] AST: ${ast.body.length} узлов`);
            }

            // Интерпретация
            const interpreter = new Interpreter({
                debug: this.debug
            });

            const result = await interpreter.interpret(ast);

            if (this.debug) {
                console.log(`[VladX] Результат:`, result);
            }

            return result;
        } catch (error) {
            console.error(`[VladX] Ошибка:`, error.message);
            if (error.stack) {
                console.error(error.stack);
            }
            throw error;
        }
    }

    async executeFile(filepath) {
        const { readFileSync } = await import('fs');
        const { resolve, dirname } = await import('path');

        try {
            const source = readFileSync(filepath, 'utf-8');
            return this.execute(source, { filename: filepath });
        } catch (error) {
            throw error;
        }
    }

    async repl(inputStream = process.stdin, outputStream = process.stdout) {
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: inputStream,
            output: outputStream,
            prompt: 'vladx> '
        });

        console.log('VladX REPL (введите .exit для выхода)');

        let buffer = '';

        rl.on('line', async (line) => {
            buffer += line + '\n';

            let complete = false;

            // Простая проверка на завершение
            if (line.trim() === '') {
                // Пустая строка - может быть конец блока
            } else {
                // Проверяем скобки
                const openParens = (buffer.match(/\(/g) || []).length;
                const openBraces = (buffer.match(/{/g) || []).length;
                const openBrackets = (buffer.match(/\[/g) || []).length;

                if (openParens === 0 && openBraces === 0 && openBrackets === 0) {
                    complete = true;
                }
            }

            if (complete || line.trim() === '') {
                if (buffer.trim()) {
                    try {
                        const result = await this.execute(buffer, { filename: '<repl>' });
                        if (result !== undefined) {
                            outputStream.write(`=> ${this.getDisplayValue(result)}\n`);
                        }
                    } catch (error) {
                        outputStream.write(`Ошибка: ${error.message}\n`);
                    }
                }
                buffer = '';
            }
        });

        rl.on('close', () => {
            outputStream.write('\nДо встречи!\n');
        });
    }

    getDisplayValue(obj) {
        if (!obj) return 'ничто';
        if (obj.type === 'string') return obj.value;
        if (obj.type === 'number') return String(obj.value);
        if (obj.type === 'boolean') return obj.value ? 'истина' : 'ложь';
        if (obj.type === 'null') return 'ничто';
        if (obj.type === 'array') return obj.value.map(v => this.getDisplayValue(v));
        if (obj.type === 'object') {
            const entries = Object.entries(obj.value || {}).map(([k, v]) => `${k}: ${this.getDisplayValue(v)}`);
            return '{ ' + entries.join(', ') + ' }';
        }
        return String(obj);
    }
}

// Для ES модулей
if (import.meta.url === `file://${process.argv[1]}`) {
    const engine = new VladXEngine();

    const command = process.argv[2];
    const args = process.argv.slice(3);

    if (command === 'run' && args[0]) {
        engine.executeFile(args[0]);
    } else if (command === 'repl') {
        engine.repl();
    } else {
        console.log(`
VladX v1.0.0

Использование:
  node vladx run <файл>  - выполнить файл
  node vladx repl             - REPL режим

Примеры:
  node vladx run examples/demo.vx
  node vladx repl
        `.trim());
    }
}

export default VladXEngine;
