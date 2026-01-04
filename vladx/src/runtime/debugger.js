/**
 * Debugger — Отладчик для пошагового выполнения
 */

export class Debugger {
    constructor(interpreter) {
        this.interpreter = interpreter;
        this.breakpoints = new Set();
        this.stepMode = false;
        this.stepDepth = 0;
        this.currentFrame = null;
        this.callStack = [];
        this.watchExpressions = [];
        this.paused = false;
        this.onNextBreakpoint = null;
        this.sourceMaps = new Map();
    }

    /**
     * Установить breakpoint
     */
    setBreakpoint(filename, line) {
        const key = `${filename}:${line}`;
        this.breakpoints.add(key);
    }

    /**
     * Удалить breakpoint
     */
    removeBreakpoint(filename, line) {
        const key = `${filename}:${line}`;
        this.breakpoints.delete(key);
    }

    /**
     * Проверить breakpoint
     */
    shouldBreak(filename, line) {
        const key = `${filename}:${line}`;
        return this.breakpoints.has(key);
    }

    /**
     * Включить пошаговый режим
     */
    stepInto() {
        this.stepMode = 'into';
        this.stepDepth = this.callStack.length;
        this.paused = false;
    }

    /**
     * Шагнуть (перепрыгнуть через функцию)
     */
    stepOver() {
        this.stepMode = 'over';
        this.stepDepth = this.callStack.length;
        this.paused = false;
    }

    /**
     * Шагнуть из функции
     */
    stepOut() {
        this.stepMode = 'out';
        this.stepDepth = this.callStack.length;
        this.paused = false;
    }

    /**
     * Продолжить выполнение
     */
    continue() {
        this.stepMode = false;
        this.paused = false;
        if (this.onNextBreakpoint) {
            this.onNextBreakpoint();
            this.onNextBreakpoint = null;
        }
    }

    /**
     * Проверить, нужно ли паузу
     */
    checkBreak(filename, line) {
        if (this.stepMode) {
            switch (this.stepMode) {
                case 'into':
                    return true;
                case 'over':
                    return this.callStack.length <= this.stepDepth;
                case 'out':
                    return this.callStack.length < this.stepDepth;
            }
        }

        return this.shouldBreak(filename, line);
    }

    /**
     * Добавить watch expression
     */
    addWatch(expression) {
        this.watchExpressions.push(expression);
    }

    /**
     * Удалить watch expression
     */
    removeWatch(expression) {
        const index = this.watchExpressions.indexOf(expression);
        if (index !== -1) {
            this.watchExpressions.splice(index, 1);
        }
    }

    /**
     * Оценить watch expressions
     */
    async evaluateWatches() {
        const results = {};

        for (const expr of this.watchExpressions) {
            try {
                results[expr] = await this.interpreter.evaluateExpression(expr);
            } catch (e) {
                results[expr] = { error: e.message };
            }
        }

        return results;
    }

    /**
     * Получить стек вызовов
     */
    getCallStack() {
        return this.callStack.map(frame => ({
            filename: frame.filename,
            line: frame.line,
            function: frame.functionName,
            locals: this.getLocals(frame)
        }));
    }

    /**
     * Получить локальные переменные
     */
    getLocals(frame) {
        if (!frame || !frame.environment) {
            return {};
        }

        const locals = {};
        for (const [key, value] of frame.environment.variables) {
            locals[key] = value;
        }

        return locals;
    }

    /**
     * Получить значение переменной
     */
    getVariable(name) {
        if (!this.currentFrame || !this.currentFrame.environment) {
            return undefined;
        }

        try {
            return this.currentFrame.environment.get(name);
        } catch (e) {
            return undefined;
        }
    }

    /**
     * Установить значение переменной
     */
    setVariable(name, value) {
        if (!this.currentFrame || !this.currentFrame.environment) {
            return false;
        }

        try {
            this.currentFrame.environment.assign(name, value);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Добавить фрейм в стек вызовов
     */
    pushFrame(frame) {
        this.callStack.push(frame);
        this.currentFrame = frame;
    }

    /**
     * Удалить фрейм из стека вызовов
     */
    popFrame() {
        this.callStack.pop();
        this.currentFrame = this.callStack[this.callStack.length - 1];
    }

    /**
     * Получить текущее состояние
     */
    getState() {
        return {
            paused: this.paused,
            breakpoints: Array.from(this.breakpoints),
            watchExpressions: [...this.watchExpressions],
            callStack: this.getCallStack(),
            currentFrame: this.currentFrame ? {
                filename: this.currentFrame.filename,
                line: this.currentFrame.line,
                function: this.currentFrame.functionName
            } : null
        };
    }

    /**
     * Добавить source map
     */
    addSourceMap(filename, map) {
        this.sourceMaps.set(filename, map);
    }

    /**
     * Конвертировать позицию в исходный код
     */
    mapPosition(filename, line, column) {
        const map = this.sourceMaps.get(filename);
        if (!map) {
            return { line, column };
        }

        // Simplified source map lookup
        // В реальной реализации нужно парсить source map JSON
        return { line, column };
    }

    /**
     * Очистить состояние
     */
    clear() {
        this.breakpoints.clear();
        this.stepMode = false;
        this.callStack = [];
        this.watchExpressions = [];
        this.currentFrame = null;
        this.paused = false;
    }
}

export default Debugger;
