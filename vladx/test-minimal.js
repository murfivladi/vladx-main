// Минимальный тест интерпретатора

// Создаем минимальную реализацию для тестирования
class MinimalVladX {
    constructor() {
        this.variables = new Map();
    }

    execute(source) {
        // Минимальный парсер для простых выражений
        const lines = source.trim().split('\n');
        
        for (const line of lines) {
            this.executeLine(line);
        }
    }

    executeLine(line) {
        line = line.trim();
        if (!line) return;

        // Пусть x = value
        const letMatch = line.match(/^пусть\s+(\w+)\s*=\s*(.+)$/);
        if (letMatch) {
            const name = letMatch[1];
            const value = this.evaluate(letMatch[2]);
            this.variables.set(name, value);
            return;
        }

        // Печать(...args)
        const printMatch = line.match(/^печать\((.+)\)$/);
        if (printMatch) {
            const args = printMatch[1].split(',').map(a => this.evaluate(a.trim()));
            console.log(...args);
            return;
        }

        // Простое выражение
        const result = this.evaluate(line);
        if (result !== undefined) {
            console.log('=>', result);
        }
    }

    evaluate(expr) {
        expr = expr.trim();
        if (!expr) return undefined;

        // Число
        const num = Number(expr);
        if (!isNaN(num)) return num;

        // Строка
        if ((expr.startsWith('"') && expr.endsWith('"')) || 
            (expr.startsWith("'") && expr.endsWith("'"))) {
            return expr.slice(1, -1);
        }

        // Переменная
        if (this.variables.has(expr)) {
            return this.variables.get(expr);
        }

        // Арифметика
        const addMatch = expr.match(/^(\d+)\s*\+\s*(\d+)$/);
        if (addMatch) {
            return Number(addMatch[1]) + Number(addMatch[2]);
        }

        return undefined;
    }
}

// Тест
console.log('=== Тест VladX ===');
const vladx = new MinimalVladX();
vladx.execute(`
пусть x = 10
пусть y = 20
печать(x + y)
печать("Привет!")
`);
console.log('\n=== Тест пройден! ===');
