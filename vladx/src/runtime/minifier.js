/**
 * Minifier — Минификатор кода VladX
 */

export class Minifier {
    constructor(options = {}) {
        this.removeComments = options.removeComments !== false;
        this.removeWhitespace = options.removeWhitespace !== false;
        this.mangleNames = options.mangleNames || false;
        this.renameVariables = options.renameVariables || false;
        this.deadCodeElimination = options.deadCodeElimination || false;
    }

    /**
     * Минифицировать код
     */
    minify(source, options = {}) {
        let code = source;

        // Удаление комментариев
        if (this.removeComments) {
            code = this.removeCommentsBlock(code);
        }

        // Удаление лишних пробелов
        if (this.removeWhitespace) {
            code = this.removeExtraWhitespace(code);
        }

        // Obfuscation имен переменных
        if (this.mangleNames) {
            code = this.mangleVariableNames(code);
        }

        // Удаление мертвого кода
        if (this.deadCodeElimination) {
            code = this.removeDeadCode(code);
        }

        return {
            code,
            originalSize: source.length,
            minifiedSize: code.length,
            reduction: ((1 - code.length / source.length) * 100).toFixed(2) + '%'
        };
    }

    /**
     * Удалить комментарии
     */
    removeCommentsBlock(code) {
        // Многострочные комментарии /* */
        code = code.replace(/\/\*[\s\S]*?\*\//g, '');

        // Однострочные комментарии //
        code = code.replace(/\/\/.*$/gm, '');

        // Русские комментарии #
        code = code.replace(/#.*$/gm, '');

        return code;
    }

    /**
     * Удалить лишние пробелы
     */
    removeExtraWhitespace(code) {
        // Заменить несколько пробелов одним
        code = code.replace(/[ \t]+/g, ' ');

        // Удалить пробелы до и после операторов
        const operators = ['+', '-', '*', '/', '%', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '!', '&', '|', '^', '~'];
        for (const op of operators) {
            code = code.replace(new RegExp(`\\s*\\${op}\\s*`, 'g'), op);
        }

        // Удалить пробелы вокруг скобок и фигурных скобок
        code = code.replace(/\s*([(){}[\],;:])\s*/g, '$1');

        // Удалить пробелы в начале и конце строк
        code = code.split('\n').map(line => line.trim()).join(' ');

        // Удалить пустые строки
        code = code.replace(/\n\s*\n/g, '\n');

        return code.trim();
    }

    /**
     * Obfuscation имен переменных
     */
    mangleVariableNames(code) {
        const keywords = new Set([
            'пусть', 'константа', 'функция', 'класс', 'вернуть', 'если', 'иначе', 'пока', 'для',
            'импорт', 'экспорт', 'из', 'поумолчанию', 'истина', 'ложь', 'ничто',
            'async', 'await', 'this', 'super', 'new', 'typeof', 'instanceof'
        ]);

        const nameMap = new Map();
        let nameIndex = 0;

        const generateShortName = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyz';
            let name = '';

            do {
                name = chars[nameIndex % chars.length] + (Math.floor(nameIndex / chars.length) > 0 ? Math.floor(nameIndex / chars.length) : '');
                nameIndex++;
            } while (keywords.has(name));

            return name;
        };

        // Найти объявления переменных
        const letPattern = /(?:пусть|let)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        const constPattern = /(?:константа|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        const funcPattern = /(?:функция|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        const paramPattern = /\(([^)]+)\)/g;

        // Собрать все имена
        const names = new Set();
        let match;

        while ((match = letPattern.exec(code)) !== null) {
            names.add(match[1]);
        }

        while ((match = constPattern.exec(code)) !== null) {
            names.add(match[1]);
        }

        while ((match = funcPattern.exec(code)) !== null) {
            names.add(match[1]);
        }

        while ((match = paramPattern.exec(code)) !== null) {
            const params = match[1].split(',').map(p => p.trim());
            params.forEach(p => {
                if (!keywords.has(p)) {
                    names.add(p);
                }
            });
        }

        // Создать map коротких имен
        for (const name of names) {
            if (!keywords.has(name) && !nameMap.has(name)) {
                nameMap.set(name, generateShortName());
            }
        }

        // Заменить имена в коде
        let mangled = code;
        for (const [oldName, newName] of nameMap) {
            const regex = new RegExp(`\\b${oldName}\\b`, 'g');
            mangled = mangled.replace(regex, newName);
        }

        return mangled;
    }

    /**
     * Удаление мертвого кода
     */
    removeDeadCode(code) {
        // Удалить недостижимый код после return
        code = code.replace(/(?:вернуть|return)[^;{};]*;[\s\S]*?(?=[{}]|$)/g, match => {
            const lines = match.split('\n');
            return lines[0] + '\n';
        });

        // Удалить недостижимый код после throw
        code = code.replace(/(?:выбросить|throw)[^;{};]*;[\s\S]*?(?=[{}]|$)/g, match => {
            const lines = match.split('\n');
            return lines[0] + '\n';
        });

        // Удалить пустые if блоки
        code = code.replace(/(?:если|if)\s*\([^)]*\)\s*{\s*}/g, '');

        // Удалить while(true) с break без тела
        code = code.replace(/(?:пока|while)\s*\(истина\)\s*{\s*(?:прервать|break)\s*;}/g, '');

        // Удалить бесполезные присваивания
        code = code.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\1\s*;?/g, '');

        return code;
    }

    /**
     * Обфускация строк
     */
    obfuscateStrings(code) {
        // Превратить строки в escape sequences
        return code.replace(/(["'])((?:\\.|(?!\1)[^\\])*)\1/g, (match, quote, content) => {
            return JSON.stringify(content);
        });
    }

    /**
     * Сжать код с помощью base64 (для дополнительной обфускации)
     */
    encode(code) {
        const encoded = Buffer.from(code).toString('base64');
        return `eval(atob('${encoded}'))`;
    }

    /**
     * Минификация с AST
     */
    minifyAST(ast) {
        // Рекурсивно обходим AST и удаляем ненужные узлы
        const optimize = (node) => {
            if (!node) return null;

            // Удалить пустые блоки
            if (node.type === 'BlockStatement' && (!node.body || node.body.length === 0)) {
                return null;
            }

            // Удалить недостижимые выражения
            if (node.type === 'ExpressionStatement' && !node.expression) {
                return null;
            }

            // Удалить ненужные свойства
            for (const key in node) {
                if (Array.isArray(node[key])) {
                    node[key] = node[key].map(optimize).filter(n => n !== null);
                } else if (typeof node[key] === 'object') {
                    node[key] = optimize(node[key]);
                }
            }

            return node;
        };

        return optimize(ast);
    }
}

export default Minifier;
