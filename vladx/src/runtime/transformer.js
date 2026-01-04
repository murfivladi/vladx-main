/**
 * Transformer — AST трансформации
 */

export class Transformer {
    constructor() {
        this.plugins = [];
    }

    /**
     * Добавить плагин
     */
    use(plugin) {
        this.plugins.push(plugin);
        return this;
    }

    /**
     * Применить трансформации к AST
     */
    transform(ast) {
        let transformed = ast;

        for (const plugin of this.plugins) {
            transformed = plugin(transformed, this.traverse);
        }

        return transformed;
    }

    /**
     * Траверс AST
     */
    traverse(node, visitor) {
        if (!node || typeof node !== 'object') {
            return;
        }

        // Enter
        if (visitor.enter) {
            const result = visitor.enter(node);
            if (result === false) return;
            if (result !== undefined) node = result;
        }

        // Traverse children
        const traverseNode = (child) => {
            if (Array.isArray(child)) {
                child.forEach(c => this.traverse(c, visitor));
            } else if (typeof child === 'object' && child !== null) {
                this.traverse(child, visitor);
            }
        };

        for (const key in node) {
            if (key === 'parent') continue;

            const child = node[key];
            if (child === node) continue;

            traverseNode(child);
        }

        // Exit
        if (visitor.exit) {
            const result = visitor.exit(node);
            if (result !== undefined) node = result;
        }
    }

    /**
     * Найти узлы по типу
     */
    find(ast, type) {
        const results = [];

        this.traverse(ast, {
            enter: (node) => {
                if (node.type === type) {
                    results.push(node);
                }
            }
        });

        return results;
    }

    /**
     * Заменить узлы по типу
     */
    replace(ast, type, replacer) {
        this.traverse(ast, {
            enter: (node, parent) => {
                if (node.type === type) {
                    const replacement = replacer(node);
                    if (parent) {
                        for (const key in parent) {
                            if (parent[key] === node) {
                                parent[key] = replacement;
                                break;
                            }
                            if (Array.isArray(parent[key])) {
                                const index = parent[key].indexOf(node);
                                if (index !== -1) {
                                    parent[key][index] = replacement;
                                }
                            }
                        }
                    }
                }
            }
        });

        return ast;
    }

    /**
     * Встроенные плагины
     */

    /**
     * Плагин: hoisting - поднятие объявлений
     */
    static hoisting() {
        return (ast, traverse) => {
            const declarations = [];

            traverse(ast, {
                enter: (node) => {
                    if (node.type === 'LetStatement' || node.type === 'ConstStatement') {
                        declarations.push(node);
                    }
                }
            });

            // Переместить объявления в начало
            for (const decl of declarations) {
                // Логика hoisting...
            }

            return ast;
        };
    }

    /**
     * Плагин: constant folding - вычисление констант во время компиляции
     */
    static constantFolding() {
        return (ast, traverse) => {
            traverse(ast, {
                enter: (node) => {
                    if (node.type === 'BinaryExpression') {
                        if (node.left.type === 'Literal' && node.right.type === 'Literal') {
                            if (typeof node.left.value === 'number' && typeof node.right.value === 'number') {
                                let result;
                                switch (node.operator) {
                                    case '+': result = node.left.value + node.right.value; break;
                                    case '-': result = node.left.value - node.right.value; break;
                                    case '*': result = node.left.value * node.right.value; break;
                                    case '/': result = node.left.value / node.right.value; break;
                                    case '%': result = node.left.value % node.right.value; break;
                                    case '**': result = Math.pow(node.left.value, node.right.value); break;
                                    default: return;
                                }

                                node.type = 'Literal';
                                node.value = result;
                                delete node.left;
                                delete node.right;
                                delete node.operator;
                            }
                        }
                    }
                }
            });

            return ast;
        };
    }

    /**
     * Плагин: dead code elimination - удаление мертвого кода
     */
    static deadCodeElimination() {
        return (ast, traverse) => {
            let unreachable = false;

            traverse(ast, {
                enter: (node) => {
                    if (node.type === 'ReturnStatement' || node.type === 'ThrowStatement') {
                        unreachable = true;
                    } else if (unreachable && node.type !== 'FunctionDeclaration') {
                        node.removed = true;
                    } else {
                        unreachable = false;
                    }
                }
            });

            return ast;
        };
    }

    /**
     * Плагин: inline small functions - inline маленьких функций
     */
    static inlineFunctions() {
        return (ast, traverse) => {
            const functions = new Map();

            // Найти маленькие функции
            traverse(ast, {
                enter: (node) => {
                    if (node.type === 'FunctionDeclaration') {
                        const bodySize = node.thenBranch?.body?.length || 0;
                        if (bodySize <= 3) {
                            functions.set(node.name, node);
                        }
                    }
                }
            });

            // Inline функции
            traverse(ast, {
                enter: (node) => {
                    if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
                        const func = functions.get(node.callee.name);
                        if (func) {
                            node.type = 'BlockStatement';
                            node.body = func.thenBranch?.body || [];
                        }
                    }
                }
            });

            return ast;
        };
    }

    /**
     * Плагин: simplify conditionals - упрощение условий
     */
    static simplifyConditionals() {
        return (ast, traverse) => {
            traverse(ast, {
                enter: (node) => {
                    if (node.type === 'IfStatement') {
                        const condition = node.condition;

                        // if (true) { ... }
                        if (condition.type === 'Literal' && condition.value === true) {
                            node.type = 'BlockStatement';
                            node.body = node.thenBranch?.body || [];
                            delete node.condition;
                            delete node.thenBranch;
                            delete node.elseBranch;
                        }

                        // if (false) { ... } else { ... }
                        if (condition.type === 'Literal' && condition.value === false) {
                            if (node.elseBranch) {
                                node.type = 'BlockStatement';
                                node.body = node.elseBranch.thenBranch?.body || [];
                            } else {
                                node.removed = true;
                            }
                        }
                    }
                }
            });

            return ast;
        };
    }
}

export default Transformer;
