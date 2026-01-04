/**
 * VladX Parser — Синтаксический анализатор
 * Преобразует поток токенов в абстрактное синтаксическое дерево (AST)
 */

import { ASTNodes } from './ast-nodes.js';

export class Parser {
    constructor(tokens, options = {}) {
        this.tokens = tokens;
        this.pos = 0;
        this.debug = options.debug || false;
    }

    /**
     * Получить текущий токен
     */
    peek(offset = 0) {
        const index = this.pos + offset;
        return index < this.tokens.length ? this.tokens[index] : this.tokens[this.tokens.length - 1];
    }

    /**
     * Получить и продвинуться
     */
    advance() {
        return this.tokens[this.pos++];
    }

    /**
     * Проверка типа текущего токена
     */
    check(type, value = null) {
        const token = this.peek();
        if (value !== null) {
            return token.type === type && token.value === value;
        }
        return token.type === type;
    }

    /**
     * Проверка и потребление токена
     */
    consume(type, value = null, message = `Expected ${type}`) {
        const token = this.peek();
        if (token.type !== type || (value !== null && token.value !== value)) {
            throw this.error(message);
        }
        return this.advance();
    }

    /**
     * Синтаксическая ошибка
     */
    error(message, token = null) {
        const t = token || this.peek();
        const filename = t.filename || '<unknown>';
        const line = t.line || '?';
        const column = t.column || '?';
        const tokenType = t.type || 'unknown';
        const tokenValue = t.value !== undefined ? t.value : 'unknown';

        return new Error(`[${filename}:${line}:${column}] Синтаксическая ошибка: ${message}\n  Токен: ${tokenType} = '${tokenValue}'`);
    }

    /**
     * Основной метод парсинга
     */
    parse() {
        try {
            const program = new ASTNodes.Program();
            program.body = this.parseStatements();
            if (this.debug) {
                console.log('[Parser] Parsed program with', program.body.length, 'statements');
            }
            return program;
        } catch (error) {
            if (this.debug) {
                console.error('[Parser] Error during parsing:', error);
                console.error('[Parser] Current token:', this.peek());
            }
            throw error;
        }
    }

    /**
     * Парсинг блока инструкций
     */
    parseStatements(endTokens = ['EOF', 'RBRACE']) {
        const body = [];
        
        while (!endTokens.includes(this.peek().type)) {
            if (this.check('NEWLINE')) {
                this.advance();
                continue;
            }
            
            const statement = this.parseStatement();
            if (statement) {
                body.push(statement);
            }
        }
        
        return body;
    }

    /**
     * Парсинг одной инструкции
     */
    parseStatement() {
        const token = this.peek();
        
        if (this.check('NEWLINE')) {
            this.advance();
            return new ASTNodes.EmptyStatement();
        }
        
        switch (token.type) {
            case 'LET':
            case 'ПУСТЬ':  // Русское ключевое слово
                return this.parseVariableDeclaration();
            
            case 'CONST':
            case 'КОНСТ':  // Русское ключевое слово
                return this.parseVariableDeclaration();
            
            case 'RETURN':
            case 'ВЕРНУТЬ':  // Русское ключевое слово
                return this.parseReturnStatement();
            
            case 'IF':
            case 'ЕСЛИ':  // Русское ключевое слово
                return this.parseIfStatement();
            
            case 'WHILE':
            case 'ПОКА':  // Русское ключевое слово
                return this.parseWhileStatement();
            
            case 'FOR':
            case 'ДЛЯ':  // Русское ключевое слово
                return this.parseForStatement();
            
            case 'BREAK':
            case 'ПРЕРВАТЬ':  // Русское ключевое слово
                return this.parseBreakStatement();
            
            case 'CONTINUE':
            case 'ПРОДОЛЖИТЬ':  // Русское ключевое слово
                return this.parseContinueStatement();
            
            case 'ASYNC':
                return this.parseAsyncFunctionDeclaration();
            case 'FUNCTION':
            case 'ФУНКЦИЯ':  // Русское ключевое слово
                return this.parseFunctionDeclaration();
            
            case 'IMPORT':
            case 'ИМПОРТ':  // Импорт модулей
                return this.parseImportStatement();
            
            case 'EXPORT':
            case 'ЭКСПОРТ':  // Экспорт имен
                return this.parseExportStatement();
            
            case 'CLASS':
            case 'КЛАСС':  // Русское ключевое слово
                return this.parseClassDeclaration();

            case 'SWITCH':
            case 'ВЫБОР':  // Русское ключевое слово
                return this.parseSwitchStatement();
            
            case 'TRY':
            case 'ПОПЫТКА':  // Русское ключевое слово
                return this.parseTryStatement();

            case 'THROW':
            case 'БРОСИТЬ':  // Русское ключевое слово
                return this.parseThrowStatement();

            case 'LBRACE':
                return this.parseBlockStatement();

            default:
                return new ASTNodes.ExpressionStatement(this.parseExpression());
        }
    }

    /**
     * Объявление переменной (пусть/const)
     */
    parseVariableDeclaration() {
        const token = this.advance();
        const isConst = token.type === 'CONST' || token.type === 'КОНСТ';

        const name = this.consume('IDENTIFIER', null, 'Ожидалось имя переменной').value;

        this.consume('ASSIGN', null, 'Ожидалось =');

        const initializer = this.parseExpression();

        // Пропуск точки с запятой
        if (this.check('SEMICOLON')) {
            this.advance();
        }

        return isConst
            ? new ASTNodes.ConstStatement(name, initializer)
            : new ASTNodes.LetStatement(name, initializer);
    }

    /**
     * Return statement
     */
    parseReturnStatement() {
        this.advance(); // consume RETURN
        
        if (this.check('NEWLINE') || this.check('RBRACE') || this.check('EOF')) {
            return new ASTNodes.ReturnStatement(null);
        }
        
        const argument = this.parseExpression();
        
        if (this.check('SEMICOLON')) {
            this.advance();
        }
        
        return new ASTNodes.ReturnStatement(argument);
    }

    /**
     * If statement
     */
    parseIfStatement() {
        this.advance(); // consume IF

        const condition = this.parseExpression();

        const thenBranch = this.parseBlockStatement();

        // Skip any newlines before checking for else/elseif
        while (this.check('NEWLINE')) {
            this.advance();
        }

        let elseBranch = null;
        if (this.check('ELSE') || this.check('ИНАЧЕ') || this.check('ELSEIF') || this.check('ИЛИЕСЛИ')) {
            elseBranch = this.parseElseClause();
        }

        return new ASTNodes.IfStatement(condition, thenBranch, elseBranch);
    }

    /**
     * Else clause
     */
    parseElseClause() {
        const token = this.peek();

        // For ELSEIF/ИЛИЕСЛИ, we need to parse the if statement that follows
        if (token.type === 'ELSEIF' || token.type === 'ИЛИЕСЛИ') {
            // Consume the ELSEIF token
            this.advance();
            // Now parse the if statement structure: condition in parentheses and then the block
            const condition = this.parseExpression();
            const thenBranch = this.parseBlockStatement();

            // Skip any newlines before checking for another else/elseif
            while (this.check('NEWLINE')) {
                this.advance();
            }

            // Check if there's another else/elseif after this one
            let elseBranch = null;
            if (this.check('ELSE') || this.check('ИНАЧЕ') || this.check('ELSEIF') || this.check('ИЛИЕСЛИ')) {
                elseBranch = this.parseElseClause();
            }

            return new ASTNodes.IfStatement(condition, thenBranch, elseBranch);
        } else {
            // For regular ELSE, just consume the token and return the block
            this.advance(); // consume ELSE or ИНАЧЕ
            return this.parseBlockStatement();
        }
    }

    /**
     * While statement
     */
    parseWhileStatement() {
        this.advance(); // consume WHILE
        
        const condition = this.parseExpression();
        const body = this.parseBlockStatement();
        
        return new ASTNodes.WhileStatement(condition, body);
    }

    /**
     * For statement
     */
    parseForStatement() {
        this.advance(); // consume FOR
        
        this.consume('LPAREN', null, 'Ожидалось (');
        
        // Инициализация - parseStatement уже потребляет точку с запятой для переменных
        let initializer = null;
        initializer = this.parseStatement();
        
        // Условие
        let condition = null;
        if (!this.check('RPAREN')) {
            condition = this.parseExpression();
            this.consume('SEMICOLON', null, 'Ожидалось ;');
        } else {
            // Если сразу ) - значит было пустое условие, нужно потребовать ;
            this.consume('SEMICOLON', null, 'Ожидалось ;');
        }
        
        // Обновление
        let update = null;
        if (!this.check('RPAREN')) {
            update = this.parseExpression();
        }
        this.consume('RPAREN', null, 'Ожидалось )');
        
        const body = this.parseBlockStatement();
        
        return new ASTNodes.ForStatement(initializer, condition, update, body);
    }

    /**
     * Break statement
     */
    parseBreakStatement() {
        this.advance();
        
        if (this.check('SEMICOLON')) {
            this.advance();
        }
        
        return new ASTNodes.BreakStatement();
    }

    /**
     * Continue statement
     */
    parseContinueStatement() {
        this.advance();
        
        if (this.check('SEMICOLON')) {
            this.advance();
        }
        
        return new ASTNodes.ContinueStatement();
    }

    /**
     * Function declaration
     */
    parseFunctionDeclaration() {
        this.advance(); // consume FUNCTION

        const name = this.consume('IDENTIFIER', null, 'Ожидалось имя функции').value;

        this.consume('LPAREN', null, 'Ожидалось (');

        const params = [];
        if (!this.check('RPAREN')) {
            while (true) {
                // Проверяем, есть ли у параметра значение по умолчанию
                let param;
                if (this.check('IDENTIFIER')) {
                    const paramName = this.consume('IDENTIFIER', null, 'Ожидался параметр').value;

                    // Проверяем, есть ли оператор присваивания (значение по умолчанию)
                    if (this.check('ASSIGN')) {
                        this.advance(); // consume =
                        const defaultValue = this.parseExpression();
                        param = new ASTNodes.AssignmentPattern(
                            new ASTNodes.Identifier(paramName),
                            defaultValue
                        );
                    } else {
                        param = new ASTNodes.Identifier(paramName);
                    }
                } else {
                    throw this.error('Ожидался параметр функции');
                }

                params.push(param);

                if (this.check('COMMA')) {
                    this.advance();
                } else {
                    break;
                }
            }
        }

        this.consume('RPAREN', null, 'Ожидалось )');

        const body = this.parseBlockStatement();

        return new ASTNodes.FunctionDeclaration(name, params, body);
    }

    /**
     * Async function declaration
     */
    parseAsyncFunctionDeclaration() {
        this.advance(); // consume ASYNC

        // Check if the next token is FUNCTION
        if (!this.check('FUNCTION') && !this.check('ФУНКЦИЯ')) {
            throw this.error('Ожидалось ключевое слово function после async');
        }

        this.advance(); // consume FUNCTION

        const name = this.consume('IDENTIFIER', null, 'Ожидалось имя функции').value;

        this.consume('LPAREN', null, 'Ожидалось (');

        const params = [];
        if (!this.check('RPAREN')) {
            while (true) {
                // Проверяем, есть ли у параметра значение по умолчанию
                let param;
                if (this.check('IDENTIFIER')) {
                    const paramName = this.consume('IDENTIFIER', null, 'Ожидался параметр').value;

                    // Проверяем, есть ли оператор присваивания (значение по умолчанию)
                    if (this.check('ASSIGN')) {
                        this.advance(); // consume =
                        const defaultValue = this.parseExpression();
                        param = new ASTNodes.AssignmentPattern(
                            new ASTNodes.Identifier(paramName),
                            defaultValue
                        );
                    } else {
                        param = new ASTNodes.Identifier(paramName);
                    }
                } else {
                    throw this.error('Ожидался параметр функции');
                }

                params.push(param);

                if (this.check('COMMA')) {
                    this.advance();
                } else {
                    break;
                }
            }
        }

        this.consume('RPAREN', null, 'Ожидалось )');

        const body = this.parseBlockStatement();

        return new ASTNodes.FunctionDeclaration(name, params, body, true); // isAsync = true
    }

    /**
     * Class declaration
     */
    parseClassDeclaration() {
        this.advance(); // consume CLASS
        
        const name = this.consume('IDENTIFIER', null, 'Ожидалось имя класса').value;
        
        // Наследование
        let superClass = null;
        if (this.check('EXTENDS')) {
            this.advance();
            superClass = this.consume('IDENTIFIER', null, 'Ожидалось имя родительского класса').value;
        }
        
        const methods = [];

        this.consume('LBRACE', null, 'Ожидалось {');

        while (!this.check('RBRACE') && !this.check('EOF')) {
            if (this.check('NEWLINE')) {
                this.advance();
                continue;
            }

            let isStatic = false;
            let isGetter = false;
            let isSetter = false;
            let isAsync = false;

            if (this.check('STATIC') || this.check('СТАТИЧЕСКИЙ')) {
                this.advance();
                isStatic = true;
            }

            if (this.check('GET')) {
                this.advance();
                isGetter = true;
            }

            if (this.check('SET')) {
                this.advance();
                isSetter = true;
            }

            if (this.check('ASYNC') || this.check('АСИНХ')) {
                this.advance();
                isAsync = true;
            }

            const methodName = this.consume('IDENTIFIER', null, 'Ожидалось имя метода').value;

            this.consume('LPAREN', null, 'Ожидалось (');

            const params = [];
            if (!this.check('RPAREN')) {
                while (true) {
                    const paramName = this.consume('IDENTIFIER', null, 'Ожидался параметр').value;
                    params.push(new ASTNodes.Identifier(paramName));

                    if (this.check('COMMA')) {
                        this.advance();
                    } else {
                        break;
                    }
                }
            }

            this.consume('RPAREN', null, 'Ожидалось )');

            const body = this.parseBlockStatement();

            methods.push(new ASTNodes.ClassMethod(methodName, params, body, isStatic, isGetter, isSetter, isAsync));
        }
        
        this.consume('RBRACE', null, 'Ожидалось }');
        
        return new ASTNodes.ClassDeclaration(name, methods, superClass);
    }

    /**
     * Try-catch statement
     */
    parseTryStatement() {
        this.advance(); // consume TRY
        
        const block = this.parseBlockStatement();
        
        // Catch
        let handler = null;
        if (this.check('CATCH') || this.check('ПЕРЕХВАТ')) {
            this.advance();
            
            let param = null;
            if (this.check('LPAREN')) {
                this.advance();
                param = this.consume('IDENTIFIER', null, 'Ожидалось имя параметра').value;
                this.consume('RPAREN', null, 'Ожидалось )');
            }
            
            const body = this.parseBlockStatement();
            handler = { param, body };
        }
        
        // Finally
        let finalizer = null;
        if (this.check('FINALLY') || this.check('НАКОНЕЦ')) {
            this.advance();
            finalizer = this.parseBlockStatement();
        }
        
        return new ASTNodes.TryStatement(block, handler, finalizer);
    }

    /**
     * Throw statement
     */
    parseThrowStatement() {
        this.advance();
        
        const argument = this.parseExpression();
        
        if (this.check('SEMICOLON')) {
            this.advance();
        }
        
        return new ASTNodes.ThrowStatement(argument);
    }

    /**
     * Switch statement
     */
    parseSwitchStatement() {
        this.advance(); // consume SWITCH or ВЫБОР

        this.consume('LPAREN', null, 'Ожидалось ( после выбор');
        const condition = this.parseExpression();
        this.consume('RPAREN', null, 'Ожидалось ) после условия выбор');

        this.consume('LBRACE', null, 'Ожидалось { после выбор');

        const cases = [];
        let defaultCase = null;

        while (!this.check('RBRACE') && !this.check('EOF')) {
            if (this.check('CASE') || this.check('КОГДА')) { // когда
                this.advance(); // consume CASE or КОГДА
                const caseValue = this.parseExpression();

                // In JavaScript-style switch, case values are followed by :
                this.consume('COLON', null, 'Expected : after case value');

                const consequent = [];

                // Parse statements until we hit the next case/default or end of switch
                while (true) {
                    // Check if the current token is a case/default token before parsing
                    if (this.check('CASE') || this.check('КОГДА') ||
                        this.check('DEFAULT') || this.check('ПоУмолчанию') ||
                        this.check('RBRACE') || this.check('EOF')) {
                        break; // Stop parsing statements
                    }
                    consequent.push(this.parseStatement());
                }

                cases.push({
                    test: caseValue,
                    consequent: consequent
                });
            } else if (this.check('DEFAULT') || this.check('ПоУмолчанию')) { // поУмолчанию
                this.advance(); // consume DEFAULT or ПоУмолчанию
                this.consume('COLON', null, 'Ожидалось : после поумолчанию');

                const consequent = [];

                // Parse statements until we hit the end of switch
                // (no more cases after default)
                while (true) {
                    // Check if the current token is a case/default token before parsing
                    if (this.check('CASE') || this.check('КОГДА') ||
                        this.check('DEFAULT') || this.check('ПоУмолчанию') ||
                        this.check('RBRACE') || this.check('EOF')) {
                        break; // Stop parsing statements
                    }
                    consequent.push(this.parseStatement());
                }

                defaultCase = {
                    consequent: consequent
                };
            } else {
                // Skip unexpected tokens
                this.advance();
            }
        }

        this.consume('RBRACE', null, 'Ожидалось } после тела выбор');

        return new ASTNodes.SwitchStatement(condition, cases, defaultCase);
    }

    /**
     * Block statement
     */
    parseBlockStatement() {
        const body = [];
        
        if (this.check('LBRACE')) {
            this.advance(); // consume {
            
            while (!this.check('RBRACE') && !this.check('EOF')) {
                if (this.check('NEWLINE')) {
                    this.advance();
                    continue;
                }
                
                const statement = this.parseStatement();
                if (statement) {
                    body.push(statement);
                }
            }
            
            this.consume('RBRACE', null, 'Ожидалось }');
        } else {
            // Одиночный оператор без блока
            body.push(this.parseStatement());
        }
        
        return new ASTNodes.BlockStatement(body);
    }

    /**
     * Парсинг выражения
     */
    parseExpression() {
        return this.parseAssignment();
    }

    /**
     * Присваивание
     */
    parseAssignment() {
        const left = this.parseTernary();

        if (this.check('ASSIGN')) {
            this.advance();
            const right = this.parseAssignment();

            // Проверяем, является ли левая часть деструктуризацией
            if (left.type === 'ArrayPattern' || left.type === 'ObjectPattern') {
                return new ASTNodes.AssignmentExpression(left, '=', right);
            } else if (left.type === 'Identifier') {
                return new ASTNodes.Assignment(left.name, right);
            } else if (left.type === 'MemberExpression') {
                return new ASTNodes.MemberAssignment(left.object, left.property, right);
            }

            return right;
        }

        // Обработка составных присваиваний
        if (this.check('PLUSEQ') || this.check('MINUSEQ') || this.check('MULTEQ') ||
            this.check('DIVEQ') || this.check('MODEQ')) {
            const operatorToken = this.advance();
            const right = this.parseAssignment();

            let operator;
            switch (operatorToken.type) {
                case 'PLUSEQ': operator = '+='; break;
                case 'MINUSEQ': operator = '-='; break;
                case 'MULTEQ': operator = '*='; break;
                case 'DIVEQ': operator = '/='; break;
                case 'MODEQ': operator = '%='; break;
                default: operator = operatorToken.value;
            }

            if (left.type === 'Identifier') {
                return new ASTNodes.CompoundAssignmentExpression(left, operator, right);
            }

            if (left.type === 'MemberExpression') {
                return new ASTNodes.CompoundAssignmentExpression(left, operator, right);
            }
        }

        return left;
    }

    /**
     * Логические операторы
     */
    parseLogical() {
        let left = this.parseComparison();

        while (this.check('AND') || this.check('OR')) {
            const operator = this.advance().value;
            const right = this.parseLogical();  // Используем тот же уровень приоритета для левой ассоциативности
            left = new ASTNodes.BinaryExpression(operator, left, right);
        }

        return left;
    }




    /**
     * Операторы сравнения
     */
    parseComparison() {
        let left = this.parseAdditive();

        const comparators = ['EQEQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE'];
        while (comparators.includes(this.peek().type)) {
            const operator = this.advance().value;
            const right = this.parseComparison();  // Используем тот же уровень приоритета для левой ассоциативности
            left = new ASTNodes.BinaryExpression(operator, left, right);
        }

        return left;
    }

    /**
     * Аддитивные операторы
     */
    parseAdditive() {
        let left = this.parseMultiplicative(); // Восстанавливаем правильный приоритет

        while (this.check('PLUS') || this.check('MINUS')) {
            const operator = this.advance().value;
            const right = this.parseAdditive();  // Используем тот же уровень приоритета для левой ассоциативности
            left = new ASTNodes.BinaryExpression(operator, left, right);
        }

        return left;
    }

    /**
     * Экспоненциальные операторы
     */
    parseExponential() {
        let left = this.parseUnary();

        while (this.check('EXP')) {
            const operator = this.advance().value;
            const right = this.parseExponential();  // Используем тот же уровень приоритета для правой ассоциативности (для экспоненты)
            left = new ASTNodes.BinaryExpression(operator, left, right);
        }

        return left;
    }

    /**
     * Битовые сдвиги
     */
    parseShift() {
        let left = this.parseMultiplicative(); // Битовые сдвиги имеют приоритет между мультипликативными и аддитивными

        while (this.check('LEFTSHIFT') || this.check('RIGHTSHIFT')) {
            const token = this.advance();
            const operator = token.value;
            const right = this.parseShift(); // Используем тот же уровень для левой ассоциативности
            left = new ASTNodes.BitwiseExpression(operator, left, right);
        }

        return left;
    }

    /**
     * Мультипликативные операторы
     */
    parseMultiplicative() {
        let left = this.parseExponential(); // Восстанавливаем правильный приоритет

        while (this.check('MULT') || this.check('DIV') || this.check('MOD')) {
            const operator = this.advance().value;
            const right = this.parseMultiplicative();  // Используем тот же уровень приоритета для левой ассоциативности
            left = new ASTNodes.BinaryExpression(operator, left, right);
        }

        return left;
    }

    /**
     * Унарные операторы
     */
    parseUnary() {
        if (this.check('MINUS') || this.check('PLUS') || this.check('NOT')) {
            const token = this.advance();
            // Convert Russian operators to standard operators for internal use
            let operator = token.value;
            if (token.value === 'не') {
                operator = '!';
            }
            const operand = this.parseUnary();
            return new ASTNodes.UnaryExpression(operator, operand);
        }

        return this.parseCallMember();
    }

    /**
     * Вызовы и доступ к членам
     */
    parseCallMember() {
        let object = this.parsePrimary();
        
        while (true) {
            if (this.check('LPAREN')) {
                // Вызов функции
                this.advance(); // consume (
                
                const args = [];
                if (!this.check('RPAREN')) {
                    while (true) {
                        // Проверяем, является ли аргумент spread оператором
                        if (this.check('SPREAD')) {
                            this.advance(); // consume '...'
                            const argument = this.parseExpression();
                            args.push(new ASTNodes.SpreadElement(argument));
                        } else {
                            args.push(this.parseExpression());
                        }

                        if (this.check('COMMA')) {
                            this.advance();
                        } else {
                            break;
                        }
                    }
                }

                this.consume('RPAREN', null, 'Ожидалось )');
                object = new ASTNodes.CallExpression(object, args);
            } else if (this.check('DOT')) {
                // Доступ к члену
                this.advance();
                const property = this.consume('IDENTIFIER', null, 'Ожидалось свойство').value;
                object = new ASTNodes.MemberExpression(object, new ASTNodes.Identifier(property));
            } else if (this.check('LBRACKET')) {
                // Доступ к элементу массива array[index]
                this.advance(); // consume [
                const index = this.parseExpression();
                this.consume('RBRACKET', null, 'Ожидалось ]');
                object = new ASTNodes.MemberExpression(object, index, true); // computed = true для array[index]
            } else {
                break;
            }
        }

        return object;
    }

    /**
     * Первичные выражения
     */
    parsePrimary() {
        const token = this.peek();
        
        // Пропускаем переводы строк перед выражением
        while (this.check('NEWLINE')) {
            this.advance();
        }
        
        switch (token.type) {
            case 'LBRACE':
                return this.parseObjectLiteral();
            
            case 'LBRACKET':
                return this.parseArrayPatternOrLiteral();

            case 'LPAREN':
                return this.parseGroupedOrSequence();
            
            case 'STRING':
                return new ASTNodes.Literal(this.advance().value);
            
            case 'INT':
                return new ASTNodes.Literal(this.advance().value);
            
            case 'TRUE':
                this.advance();
                return new ASTNodes.Literal(true);
            
            case 'FALSE':
                this.advance();
                return new ASTNodes.Literal(false);
            
            case 'NULL':
            case 'NOTHING':
                this.advance();
                return new ASTNodes.Literal(null);
            
            case 'IDENTIFIER':
                return new ASTNodes.Identifier(this.advance().value);

            case 'THIS':
                this.advance();
                return new ASTNodes.ThisExpression();

            case 'SUPER':
                this.advance();
                return new ASTNodes.SuperExpression();

            case 'TEMPLATE_LITERAL':
                return this.parseTemplateLiteral();

            case 'IMPORT':
            case 'ИМПОРТ':
                return this.parseImportExpression();

            case 'AWAIT':
                return this.parseAwaitExpression();

            case 'AWAIT':
                return this.parseAwaitExpression();

            case 'FUNCTION':
                return this.parseArrowFunction();

            case 'NEW':
                return this.parseNewExpression();

            default:
                throw this.error(`Ожидалось выражение, получено: ${token.type}`);
        }
    }

    /**
     * Объектный литерал или паттерн
     */
    parseObjectPatternOrLiteral() {
        this.consume('LBRACE', null, 'Ожидалась {');

        const properties = [];
        let isPattern = false;

        // Пропускаем переводы строк в начале объекта
        while (this.check('NEWLINE')) {
            this.advance();
        }

        while (!this.check('RBRACE')) {
            // Пропускаем переводы строк между свойствами
            while (this.check('NEWLINE')) {
                this.advance();
            }

            if (this.check('COMMA')) {
                this.advance();
                continue;
            }

            // Проверяем, является ли это паттерном деструктуризации
            // В паттерне ключ может быть идентификатором, и если нет двоеточия, это сокращенная запись
            let key;
            if (this.check('IDENTIFIER')) {
                key = new ASTNodes.Identifier(this.advance().value);
                isPattern = true;
            } else if (this.check('STRING')) {
                key = new ASTNodes.PropertyKey(this.advance().value);
            } else {
                throw this.error('Ожидался ключ свойства');
            }

            let value = key; // По умолчанию значение такое же, как ключ (для сокращенной записи)

            // Если есть двоеточие, значит это полная запись (ключ: значение)
            if (this.check('COLON')) {
                this.advance(); // пропускаем двоеточие
                value = this.parsePatternOrExpression(); // для паттернов может быть идентификатор
            }

            properties.push(new ASTNodes.Property(key, value));

            // Пропускаем переводы строк после свойства
            while (this.check('NEWLINE')) {
                this.advance();
            }

            // Проверяем, есть ли еще свойства
            if (!this.check('RBRACE')) {
                this.consume('COMMA', null, 'Ожидалась ,');
            }
        }

        this.consume('RBRACE', null, 'Ожидалась }');

        // Возвращаем паттерн, если мы в контексте присваивания, иначе выражение
        if (isPattern) {
            return new ASTNodes.ObjectPattern(properties);
        } else {
            return new ASTNodes.ObjectExpression(properties);
        }
    }

    /**
     * Объектный литерал
     */
    parseObjectLiteral() {
        this.consume('LBRACE', null, 'Ожидалась {');

        const properties = [];

        // Пропускаем переводы строк в начале объекта
        while (this.check('NEWLINE')) {
            this.advance();
        }

        while (!this.check('RBRACE')) {
            // Пропускаем переводы строк между свойствами
            while (this.check('NEWLINE')) {
                this.advance();
            }

            if (this.check('COMMA')) {
                this.advance();
                continue;
            }

            // Ключ свойства
            let key;
            if (this.check('IDENTIFIER')) {
                key = new ASTNodes.PropertyKey(this.advance().value);
            } else if (this.check('STRING')) {
                key = new ASTNodes.PropertyKey(this.advance().value);
            } else {
                throw this.error('Ожидался ключ свойства');
            }

            // Двоеточие
            this.consume('COLON', null, 'Ожидалось :');

            // Значение
            const value = this.parseExpression();

            properties.push(new ASTNodes.PropertyDefinition(key, value));

            // Пропускаем переводы строк после свойства
            while (this.check('NEWLINE')) {
                this.advance();
            }

            // Проверяем, есть ли еще свойства
            if (!this.check('RBRACE')) {
                this.consume('COMMA', null, 'Ожидалась ,');
            }
        }

        this.consume('RBRACE', null, 'Ожидалась }');

        return new ASTNodes.ObjectExpression(properties);
    }

    /**
     * Массив или паттерн массива
     */
    parseArrayPatternOrLiteral() {
        this.consume('LBRACKET', null, 'Ожидалось [');

        const elements = [];
        let isPattern = false;
        let hasSpread = false;

        while (!this.check('RBRACKET')) {
            // Skip any newlines before checking for comma or elements
            while (this.check('NEWLINE')) {
                this.advance();
            }

            // Check if next token after a comma is another comma (empty slot) or closing bracket
            if (this.check('COMMA')) {
                // Empty slot - push null
                elements.push(null);
                this.advance(); // consume comma
                continue;
            }

            // Skip any newlines before parsing the element
            while (this.check('NEWLINE')) {
                this.advance();
            }

            // Проверяем, является ли элемент spread оператором
            if (this.check('SPREAD')) {
                this.advance(); // consume '...'
                const argument = this.parsePatternOrExpression();
                elements.push(new ASTNodes.SpreadElement(argument));
                hasSpread = true;
            } else {
                // Проверяем, является ли элемент паттерном (идентификатором или другим паттерном)
                // до того, как его распарсим
                const isElementPattern = this.check('IDENTIFIER') || this.check('LBRACKET') || this.check('LBRACE');
                if (isElementPattern) {
                    isPattern = true;
                }

                elements.push(this.parsePatternOrExpression());
            }

            if (this.check('COMMA')) {
                this.advance();
            } else {
                break;
            }
        }

        // Skip any newlines before consuming the closing bracket
        while (this.check('NEWLINE')) {
            this.advance();
        }

        this.consume('RBRACKET', null, 'Ожидалось ]');

        // Возвращаем паттерн, если мы в контексте присваивания или содержит паттерны
        if (hasSpread) {
            return new ASTNodes.ArrayExpression(elements);
        } else if (isPattern) {
            return new ASTNodes.ArrayPattern(elements);
        } else {
            return new ASTNodes.ArrayExpression(elements);
        }
    }

    /**
     * Паттерн или выражение
     */
    parsePatternOrExpression() {
        // Проверяем, является ли это паттерном деструктуризации
        if (this.check('IDENTIFIER')) {
            return new ASTNodes.Identifier(this.advance().value);
        } else if (this.check('LBRACKET')) {
            return this.parseArrayPatternOrLiteral();
        } else if (this.check('LBRACE')) {
            return this.parseObjectPatternOrLiteral();
        } else {
            // Иначе это обычное выражение
            return this.parseExpression();
        }
    }

    /**
     * Массив
     */
    parseArrayLiteral() {
        this.consume('LBRACKET', null, 'Ожидалось [');

        const elements = [];

        while (!this.check('RBRACKET')) {
            if (this.check('COMMA')) {
                elements.push(null);
                this.advance();
                continue;
            }

            elements.push(this.parseExpression());

            if (this.check('COMMA')) {
                this.advance();
            } else {
                break;
            }
        }

        this.consume('RBRACKET', null, 'Ожидалось ]');

        return new ASTNodes.ArrayExpression(elements);
    }

    /**
     * Группировка или последовательность
     */
    parseGroupedOrSequence() {
        this.advance(); // consume (

        // Проверяем, пустая ли группа или последовательность
        if (this.check('RPAREN')) {
            this.advance();
            return new ASTNodes.ArrayExpression([]);
        }

        const expr = this.parseExpression();

        if (this.check('COMMA')) {
            // Последовательность (a, b, c)
            const expressions = [expr];

            while (this.check('COMMA')) {
                this.advance();
                expressions.push(this.parseExpression());
            }

            this.consume('RPAREN', null, 'Ожидалось )');

            // Возвращаем последовательность
            return new ASTNodes.SequenceExpression(expressions);
        }

        this.consume('RPAREN', null, 'Ожидалось )');
        return expr;
    }

    /**
     * Тернарный оператор (условие ? then : else)
     */
    parseTernary() {
        let condition = this.parseLogical();

        if (this.check('TERNARY')) {
            this.advance(); // consume '?'
            const thenBranch = this.parseAssignment(); // use same precedence level for branches
            this.consume('COLON', null, 'Expected : in ternary operator');
            const elseBranch = this.parseAssignment(); // use same precedence level for branches
            return new ASTNodes.TernaryExpression(condition, thenBranch, elseBranch);
        }

        return condition;
    }

    /**
     * Шаблонная строка
     */
    parseTemplateLiteral() {
        const token = this.advance();
        const value = token.value;

        // Простая реализация - возвращаем как строку
        // В реальности нужно разобрать интерполяции ${...}
        return new ASTNodes.Literal(value);
    }

    /**
     * Await выражение
     */
    parseAwaitExpression() {
        this.advance(); // consume AWAIT
        const argument = this.parseUnary(); // Await имеет тот же приоритет, что и унарные операторы
        return new ASTNodes.AwaitExpression(argument);
    }

    /**
     * Стрелочная функция
     */
    parseArrowFunction() {
        const func = this.parseFunctionDeclaration();

        return new ASTNodes.ArrowFunctionExpression(func.params, func.body);
    }

    /**
     * Import statement - импорт модуля
     */
    parseImportStatement() {
        this.advance(); // consume IMPORT или ИМПОРТ

        const pathToken = this.consume('STRING', null, 'Ожидался строковый путь к модулю');
        const path = pathToken.value;

        let alias = null;

        // Проверяем, идёт ли токен AS ("как" или "as")
        if (this.check('AS')) {
            this.advance(); // пропускаем "как" или "as"

            const aliasToken = this.consume('IDENTIFIER', null, 'Ожидалось имя переменной после "как" или "as"');
            alias = aliasToken.value;
        }

        // Точка с запятой опциональна
        if (this.check('SEMICOLON')) {
            this.advance();
        }

        return new ASTNodes.ImportStatement(path, alias);
    }
    /**
     * Export statement - экспорт имен
     */
    parseExportStatement() {
        this.advance(); // consume EXPORT
        
        this.consume('LBRACE', null, 'Ожидалось {');
        
        const identifiers = [];
        
        if (!this.check('RBRACE')) {
            while (true) {
                const name = this.consume('IDENTIFIER', null, 'Ожидалось имя для экспорта').value;
                identifiers.push(name);
                
                if (this.check('COMMA')) {
                    this.advance();
                } else {
                    break;
                }
            }
        }
        
        this.consume('RBRACE', null, 'Ожидалось }');
        
        // Пропуск точки с запятой
        if (this.check('SEMICOLON')) {
            this.advance();
        }

        return new ASTNodes.ExportStatement(identifiers);
    }

    /**
     * New expression - создание экземпляра класса
     */
    parseNewExpression() {
        this.advance();

        const callee = this.parsePrimary();

        const args = [];
        if (this.check('LPAREN')) {
            this.advance();
            if (!this.check('RPAREN')) {
                while (true) {
                    if (this.check('SPREAD')) {
                        this.advance();
                        const argument = this.parseExpression();
                        args.push(new ASTNodes.SpreadElement(argument));
                    } else {
                        args.push(this.parseExpression());
                    }

                    if (this.check('COMMA')) {
                        this.advance();
                    } else {
                        break;
                    }
                }
            }
            this.consume('RPAREN', null, 'Ожидалось )');
        }

        return new ASTNodes.NewExpression(callee, args);
    }
}
