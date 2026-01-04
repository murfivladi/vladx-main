/**
 * VladX Lexer — Лексический анализатор
 * Преобразует исходный код в поток токенов
 */

export class Lexer {
    constructor(source, filename = '<anonymous>') {
        this.source = source;
        this.filename = filename;
        this.pos = 0;
        this.line = 1;
        this.column = 0;
        this.tokens = [];
        this.currentChar = this.source[0] || null;
    }

    /**
     * Основной метод токенизации
     */
    tokenize() {
        try {
            while (this.currentChar !== null) {
                // Пропускаем пробелы и табы (но не переводы строк)
                if (this.currentChar === ' ' || this.currentChar === '\t') {
                    this.advance();
                    continue;
                }

                // Перевод строки
                if (this.currentChar === '\n') {
                    this.tokens.push({
                        type: 'NEWLINE',
                        value: '\n',
                        line: this.line,
                        column: this.column,
                        filename: this.filename
                    });
                    this.line++;
                    this.column = 0;
                    this.advance();
                    continue;
                }

                // Комментарии
                if (this.currentChar === '#' ||
                    (this.currentChar === '/' && this.peek() === '*') ||
                    (this.currentChar === '/' && this.peek() === '/')) {
                    this.skipComment();
                    continue;
                }

                // Строковые литералы
                if (this.currentChar === '"' || this.currentChar === "'") {
                const token = this.readStringLiteral();
                this.tokens.push(token);
                continue;
            }

            // Идентификаторы и ключевые слова
            if (this.isAlpha(this.currentChar) || this.currentChar === '_') {
                const token = this.readIdentifier();
                this.tokens.push(token);
                continue;
            }

            // Шаблонные строки (начинаются с `)
            if (this.currentChar === '`') {
                const token = this.readTemplateLiteral();
                this.tokens.push(token);
                continue;
            }

            // Числа
            if (this.isDigit(this.currentChar)) {
                const token = this.readNumber();
                this.tokens.push(token);
                continue;
            }

            // Операторы и символы
            const token = this.readOperator();
            if (token) {
                this.tokens.push(token);
                continue;
            } else if (this.currentChar === '/' && this.peek() === '*') {
                // Это начало многострочного комментария, пропускаем его
                this.skipComment();
                continue;
            } else if (this.currentChar === '/' && this.peek() === '/') {
                // Это начало однострочного комментария, пропускаем его
                this.skipComment();
                continue;
            }

            // Неизвестный символ
            throw new Error(`[${this.filename}:${this.line}:${this.column}] Неизвестный символ: '${this.currentChar}' (код: ${this.currentChar.charCodeAt(0)})`);
        }

        // Добавляем EOF токен
        this.tokens.push({
            type: 'EOF',
            value: null,
            line: this.line,
            column: this.column,
            filename: this.filename
        });

        return this.tokens;
        } catch (error) {
            if (this.debug) {
                console.error('[Lexer] Error during tokenization:', error);
                console.error('[Lexer] Position:', this.pos, 'Char:', this.currentChar);
            }
            throw error;
        }
    }

    /**
     * Продвижение по строке
     */
    advance() {
        this.pos++;
        this.column++;
        this.currentChar = this.source[this.pos] || null;
    }

    /**
     * Пропуск комментариев
     */
    skipComment() {
        if (this.currentChar === '#') {
            // Однострочный комментарий
            while (this.currentChar !== null && this.currentChar !== '\n') {
                this.advance();
            }
        } else if (this.currentChar === '/' && this.peek() === '*') {
            // Многострочный комментарий /* ... */
            this.advance(); // пропускаем '/'
            this.advance(); // пропускаем '*'
            while (this.currentChar !== null) {
                if (this.currentChar === '\n') {
                    this.line++;
                    this.column = 0;
                } else {
                    this.column++;
                }

                if (this.currentChar === '*' && this.peek() === '/') {
                    this.advance(); // пропускаем '*'
                    this.advance(); // пропускаем '/'
                    break;
                }
                this.advance();
            }
        } else if (this.currentChar === '/' && this.peek() === '/') {
            // Однострочный комментарий // ...
            this.advance(); // пропускаем '/'
            this.advance(); // пропускаем '/'
            while (this.currentChar !== null && this.currentChar !== '\n') {
                this.advance();
            }
        }
    }

    /**
     * Чтение строкового литерала
     */
    readStringLiteral() {
        const quote = this.currentChar;
        this.advance(); // Пропускаем открывающую кавычку
        
        let value = '';
        const startLine = this.line;
        const startColumn = this.column;

        while (this.currentChar !== null && this.currentChar !== quote) {
                        if (this.currentChar === '\\') {
                this.advance();
                if (this.currentChar === null) {
                    throw new Error("Незавершённая escape-последовательность в строке");
                }

                switch (this.currentChar) {
                    case 'n':
                        value += '\n';
                        break;
                    case 't':
                        value += '\t';
                        break;
                    case 'r':
                        value += '\r';
                        break;
                    case '"':
                        value += '"';
                        break;
                    case "'":
                        value += "'";
                        break;
                    case '\\':
                        value += '\\';
                        break;
                    case 'x': // \xHH — hex код
                        this.advance();
                        const hex1 = this.currentChar;
                        this.advance();
                        const hex2 = this.currentChar;
                        if (hex1 && hex2 && /[0-9a-fA-F]{2}/.test(hex1 + hex2)) {
                            value += String.fromCharCode(parseInt(hex1 + hex2, 16));
                        } else {
                            throw new Error(`Неверный \\x escape: \\x${hex1 || ''}${hex2 || ''}`);
                        }
                        break;
                    case 'u': // \uHHHH — unicode
                        this.advance();
                        let unicode = '';
                        for (let i = 0; i < 4; i++) {
                            if (this.currentChar && /[0-9a-fA-F]/.test(this.currentChar)) {
                                unicode += this.currentChar;
                                this.advance();
                            } else {
                                throw new Error(`Неверный \\u escape: \\u${unicode}`);
                            }
                        }
                        value += String.fromCharCode(parseInt(unicode, 16));
                        this.advance(); // пропустить после \uHHHH
                        continue; // чтобы не добавлять последний символ как обычный
                    default:
                        value += '\\' + this.currentChar; // неизвестный escape — оставляем как есть
                }
                this.advance();
                continue;
            } else {
                value += this.currentChar;
                this.advance();
            }
        }

        this.advance(); // Пропускаем закрывающую кавычку

        return {
            type: 'STRING',
            value: value,
            line: startLine,
            column: startColumn,
            filename: this.filename
        };
    }

    /**
     * Обработка escape-последовательностей
     */
    escapeChar(char) {
        const escapes = {
            'n': '\n',
            't': '\t',
            'r': '\r',
            '\\': '\\',
            '"': '"',
            "'": "'"
        };
        return escapes[char] || char;
    }

    /**
     * Чтение шаблонной строки
     */
    readTemplateLiteral() {
        this.advance(); // Пропускаем открывающую обратную кавычку

        let value = '';
        const startLine = this.line;
        const startColumn = this.column;

        while (this.currentChar !== null && this.currentChar !== '`') {
            if (this.currentChar === '\\') {
                this.advance();
                if (this.currentChar === null) {
                    throw new Error("Незавершённая escape-последовательность в шаблонной строке");
                }
                value += this.escapeChar(this.currentChar);
                this.advance();
            } else if (this.currentChar === '$' && this.peek() === '{') {
                // Это начало интерполяции ${...}
                value += this.currentChar; // Добавляем $
                this.advance(); // Пропускаем $
                value += this.currentChar; // Добавляем {
                this.advance(); // Пропускаем {
            } else {
                value += this.currentChar;
                this.advance();
            }
        }

        if (this.currentChar !== '`') {
            throw new Error(`Незавершённая шаблонная строка, ожидалась обратная кавычка`);
        }

        this.advance(); // Пропускаем закрывающую обратную кавычку

        return {
            type: 'TEMPLATE_LITERAL',
            value: value,
            line: startLine,
            column: startColumn,
            filename: this.filename
        };
    }

    /**
     * Чтение идентификатора или ключевого слова
     */
    readIdentifier() {
    let value = '';
    const startLine = this.line;
    const startColumn = this.column;

    while (this.currentChar !== null && (this.isAlphaNumeric(this.currentChar) || this.currentChar === '_')) {
        value += this.currentChar;
        this.advance();
    }

    // Проверка на ключевые слова - маппинг русских слов к латинским типам токенов
    const keywordToTokenType = {
        'let': 'LET',
        'пусть': 'LET',
        'const': 'CONST',
        'конст': 'CONST',
        'константа': 'CONST',
        'if': 'IF',
        'если': 'IF',
        'else': 'ELSE',
        'иначе': 'ELSE',
        'elseif': 'ELSEIF',
        'иначеесли': 'ELSEIF',
        'илиесли': 'ИЛИЕСЛИ',
        'while': 'WHILE',
        'пока': 'WHILE',
        'for': 'FOR',
        'для': 'FOR',
        'function': 'FUNCTION',
        'функция': 'FUNCTION',
        'return': 'RETURN',
        'вернуть': 'RETURN',
        'class': 'CLASS',
        'класс': 'CLASS',
        'class': 'CLASS',
        'this': 'THIS',
        'это': 'THIS',
        'super': 'SUPER',
        'супер': 'SUPER',
        'new': 'NEW',
        'новый': 'NEW',
        'extends': 'EXTENDS',
        'расширяет': 'EXTENDS',
        'try': 'TRY',
        'попытка': 'TRY',
        'catch': 'CATCH',
        'перехват': 'CATCH',
        'исключение': 'CATCH',
        'finally': 'FINALLY',
        'наконец': 'FINALLY',
        'throw': 'THROW',
        'бросить': 'THROW',
        'break': 'BREAK',
        'прервать': 'BREAK',
        'continue': 'CONTINUE',
        'продолжить': 'CONTINUE',
        'static': 'STATIC',
        'СТАТИЧЕСКИЙ': 'STATIC',
        'статический': 'STATIC',
        'get': 'GET',
        'set': 'SET',
        'true': 'TRUE',
        'истина': 'TRUE',
        'false': 'FALSE',
        'ложь': 'FALSE',
        'null': 'NULL',
        'ничто': 'NULL',
        'nothing': 'NULL',
        'import': 'IMPORT',
        'импорт': 'IMPORT',
        'export': 'EXPORT',
        'экспорт': 'EXPORT',
        'from': 'FROM',
        'из': 'FROM',
        'as': 'AS',
        'как': 'AS',
        'and': 'AND',
        'и': 'AND',
        'or': 'OR',
        'или': 'OR',
        'with': 'WITH',
        'с': 'WITH',
        'to': 'TO',
        'до': 'TO',
        'switch': 'SWITCH',
        'выбор': 'SWITCH',
        'case': 'CASE',
        'когда': 'CASE',
        'default': 'DEFAULT',
        'поумолчанию': 'DEFAULT',
        'async': 'ASYNC',
        'асинх': 'ASYNC',
        'await': 'AWAIT',
        'ожидать': 'AWAIT'
    };

    const lowerValue = value.toLowerCase();
    const type = Object.prototype.hasOwnProperty.call(keywordToTokenType, lowerValue) ? keywordToTokenType[lowerValue] : 'IDENTIFIER';

    return {
        type: type,
        value: value,
        line: startLine,
        column: startColumn,
        filename: this.filename
    };
}
    /**
     * Чтение числа
     */
    readNumber() {
        let value = '';
        const startLine = this.line;
        const startColumn = this.column;
        let hasDecimal = false;

        while (this.currentChar !== null) {
            if (this.isDigit(this.currentChar)) {
                value += this.currentChar;
                this.advance();
            } else if (this.currentChar === '.' && !hasDecimal) {
                hasDecimal = true;
                value += this.currentChar;
                this.advance();
            } else {
                break;
            }
        }

        return {
            type: 'INT',
            value: hasDecimal ? parseFloat(value) : parseInt(value, 10),
            line: startLine,
            column: startColumn,
            filename: this.filename
        };
    }

    /**
     * Чтение операторов и символов
     */
    readOperator() {
        const startLine = this.line;
        const startColumn = this.column;
        const char = this.currentChar;

        // Многосимвольные операторы
        if (char === '=' && this.peek() === '=') {
            this.advance();
            this.advance();
            return { type: 'EQEQ', value: '==', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '!' && this.peek() === '=') {
            this.advance();
            this.advance();
            return { type: 'NEQ', value: '!=', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '<' && this.peek() === '=') {
            this.advance();
            this.advance();
            return { type: 'LTE', value: '<=', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '>' && this.peek() === '=') {
            this.advance();
            this.advance();
            return { type: 'GTE', value: '>=', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '&' && this.peek() === '&') {
            this.advance();
            this.advance();
            return { type: 'AND', value: '&&', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '|' && this.peek() === '|') {
            this.advance();
            this.advance();
            return { type: 'OR', value: '||', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '*' && this.peek() === '*') {
            this.advance();
            this.advance();
            return { type: 'EXP', value: '**', line: startLine, column: startColumn, filename: this.filename };
        }
        // Добавляем дополнительные операторы
        if (char === '+' && this.peek() === '=') {
            this.advance();
            this.advance();
            return { type: 'PLUSEQ', value: '+=', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '-' && this.peek() === '=') {
            this.advance();
            this.advance();
            return { type: 'MINUSEQ', value: '-=', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '*' && this.peek() === '=') {
            this.advance();
            this.advance();
            return { type: 'MULTEQ', value: '*=', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '/' && this.peek() === '=') {
            this.advance();
            this.advance();
            return { type: 'DIVEQ', value: '/=', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '%' && this.peek() === '=') {
            this.advance();
            this.advance();
            return { type: 'MODEQ', value: '%=', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '<' && this.peek() === '<') {
            this.advance();
            this.advance();
            return { type: 'LEFTSHIFT', value: '<<', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '>' && this.peek() === '>') {
            this.advance();
            this.advance();
            return { type: 'RIGHTSHIFT', value: '>>', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === '=' && this.peek() === '>') {
            this.advance();
            this.advance();
            return { type: 'FATARROW', value: '=>', line: startLine, column: startColumn, filename: this.filename };
        }

        // Импорт/экспорт модулей
        if (char === 'i' && this.peek() === 'm' && this.peek(1) === 'p' && this.peek(2) === 'o' && this.peek(3) === 'r' && this.peek(4) === 't') {
            this.advance(); this.advance(); this.advance(); this.advance(); this.advance();
            return { type: 'IMPORT', value: 'import', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === 'э' && this.peek() === 'к' && this.peek(1) === 'с' && this.peek(2) === 'п' && this.peek(3) === 'о' && this.peek(4) === 'р' && this.peek(5) === 'т') {
            for (let i = 0; i < 7; i++) this.advance();
            return { type: 'EXPORT', value: 'экспорт', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === 'e' && this.peek() === 'x' && this.peek(1) === 'p' && this.peek(2) === 'o' && this.peek(3) === 'r' && this.peek(4) === 't') {
            this.advance(); this.advance(); this.advance(); this.advance(); this.advance();
            return { type: 'EXPORT', value: 'export', line: startLine, column: startColumn, filename: this.filename };
        }
        if (char === 'и' && this.peek() === 'м' && this.peek(1) === 'п' && this.peek(2) === 'о' && this.peek(3) === 'р' && this.peek(4) === 'т') {
            for (let i = 0; i < 5; i++) this.advance();
            return { type: 'IMPORT', value: 'импорт', line: startLine, column: startColumn, filename: this.filename };
        }
                // Поддержка "как" и "as" в импорте
                        if (char === 'к' && this.peek() === 'а' && this.peek(1) === 'к') {
                                    this.advance(); this.advance(); this.advance();
                                                return { type: 'AS', value: 'как', line: startLine, column: startColumn, filename: this.filename };
                                                        }
                                                                if (char === 'a' && this.peek() === 's') {
                                                                            this.advance(); this.advance();
                                                                                        return { type: 'AS', value: 'as', line: startLine, column: startColumn, filename: this.filename };
                                                                                                }

        // Проверяем, не является ли '/' началом комментария
        if (char === '/') {
            if (this.peek() === '*') {
                // Это начало многострочного комментария, не обрабатываем здесь
                return null;
            } else {
                this.advance();
                return {
                    type: 'DIV',
                    value: '/',
                    line: startLine,
                    column: startColumn,
                    filename: this.filename
                };
            }
        }

        // Многосимвольные операторы (до одиночных)
        if (char === '.' && this.peek() === '.' && this.peek(1) === '.') {
            this.advance();
            this.advance();
            this.advance();
            return { type: 'SPREAD', value: '...', line: startLine, column: startColumn, filename: this.filename };
        }

        // Одиночные символы
        const singleChars = {
            '+': 'PLUS',
            '-': 'MINUS',
            '*': 'MULT',
            '%': 'MOD',
            '=': 'ASSIGN',
            '.': 'DOT',
            '(': 'LPAREN',
            ')': 'RPAREN',
            '{': 'LBRACE',
            '}': 'RBRACE',
            '[': 'LBRACKET',
            ']': 'RBRACKET',
            ',': 'COMMA',
            ':': 'COLON',
            ';': 'SEMICOLON',
            '<': 'LT',
            '>': 'GT',
            '!': 'NOT',
            '?': 'TERNARY'
        };

        if (singleChars[char]) {
            this.advance();
            return {
                type: singleChars[char],
                value: char,
                line: startLine,
                column: startColumn,
                filename: this.filename
            };
        }

        return null;
    }

    /**
     * Подглядывание следующего символа
     */
    peek() {
        return this.source[this.pos + 1] || null;
    }

    /**
     * Проверка на букву (включая русские буквы)
     */
    isAlpha(char) {
        const code = char.charCodeAt(0);
        // Латинские буквы
        if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || char === '_') {
            return true;
        }
        // Русские буквы (А-Я, а-я, Ё, ё)
        if ((code >= 1040 && code <= 1103) || code === 1025 || code === 1105) {
            return true;
        }
        return false;
    }

    /**
     * Проверка на цифру
     */
    isDigit(char) {
        return char >= '0' && char <= '9';
    }

    /**
     * Проверка на букву или цифру
     */
    isAlphaNumeric(char) {
        return this.isAlpha(char) || this.isDigit(char);
    }
}

export default Lexer;
