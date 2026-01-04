/**
 * VladX AST Nodes — Узлы абстрактного синтаксического дерева
 */

// Базовые узлы
export class Node {
    constructor(type) {
        this.type = type;
    }
}

export class Program extends Node {
    constructor() {
        super('Program');
        this.body = [];
    }
}

// Statements
export class ExpressionStatement extends Node {
    constructor(expression) {
        super('ExpressionStatement');
        this.expression = expression;
    }
}

export class EmptyStatement extends Node {
    constructor() {
        super('EmptyStatement');
    }
}

export class LetStatement extends Node {
    constructor(name, initializer) {
        super('LetStatement');
        this.name = name;
        this.initializer = initializer;
    }
}

export class ConstStatement extends Node {
    constructor(name, initializer) {
        super('ConstStatement');
        this.name = name;
        this.initializer = initializer;
    }
}

export class ReturnStatement extends Node {
    constructor(argument) {
        super('ReturnStatement');
        this.argument = argument;
    }
}

export class BlockStatement extends Node {
    constructor(body = []) {
        super('BlockStatement');
        this.body = body;
    }
}

export class IfStatement extends Node {
    constructor(condition, thenBranch, elseBranch = null) {
        super('IfStatement');
        this.condition = condition;
        this.thenBranch = thenBranch;
        this.elseBranch = elseBranch;
    }
}

export class WhileStatement extends Node {
    constructor(condition, body) {
        super('WhileStatement');
        this.condition = condition;
        this.body = body;
    }
}

export class ForStatement extends Node {
    constructor(initializer, condition, update, body) {
        super('ForStatement');
        this.initializer = initializer;
        this.condition = condition;
        this.update = update;
        this.body = body;
    }
}

export class BreakStatement extends Node {
    constructor() {
        super('BreakStatement');
    }
}

export class ContinueStatement extends Node {
    constructor() {
        super('ContinueStatement');
    }
}

export class FunctionDeclaration extends Node {
    constructor(name, params, body, isAsync = false) {
        super('FunctionDeclaration');
        this.name = name;
        this.params = params;
        this.body = body;
        this.isAsync = isAsync;
    }
}

export class ClassDeclaration extends Node {
    constructor(name, methods, superClass = null) {
        super('ClassDeclaration');
        this.name = name;
        this.methods = methods;
        this.superClass = superClass;
    }
}

export class TryStatement extends Node {
    constructor(block, handler = null, finalizer = null) {
        super('TryStatement');
        this.block = block;
        this.handler = handler;
        this.finalizer = finalizer;
    }
}

export class ThrowStatement extends Node {
    constructor(argument) {
        super('ThrowStatement');
        this.argument = argument;
    }
}

// Expressions
export class Literal extends Node {
    constructor(value) {
        super('Literal');
        this.value = value;
    }
}

export class Identifier extends Node {
    constructor(name) {
        super('Identifier');
        this.name = name;
    }
}

export class ThisExpression extends Node {
    constructor() {
        super('ThisExpression');
    }
}

export class SuperExpression extends Node {
    constructor() {
        super('SuperExpression');
    }
}

export class NewExpression extends Node {
    constructor(callee, args = []) {
        super('NewExpression');
        this.callee = callee;
        this.args = args;
    }
}

export class ClassMethod extends FunctionDeclaration {
    constructor(name, params, body, isStatic = false, isGetter = false, isSetter = false, isAsync = false) {
        super(name, params, body, isAsync);
        this.isStatic = isStatic;
        this.isGetter = isGetter;
        this.isSetter = isSetter;
    }
}

export class BinaryExpression extends Node {
    constructor(operator, left, right) {
        super('BinaryExpression');
        this.operator = operator;
        this.left = left;
        this.right = right;
    }
}

export class UnaryExpression extends Node {
    constructor(operator, operand) {
        super('UnaryExpression');
        this.operator = operator;
        this.operand = operand;
    }
}

export class CallExpression extends Node {
    constructor(callee, args = []) {
        super('CallExpression');
        this.callee = callee;
        this.args = args;
    }
}

export class MemberExpression extends Node {
    constructor(object, property, computed = false) {
        super('MemberExpression');
        this.object = object;
        this.property = property;
        this.computed = computed;
    }
}

export class MemberAssignment extends Node {
    constructor(object, property, value) {
        super('MemberAssignment');
        this.object = object;
        this.property = property;
        this.value = value;
    }
}

export class Assignment extends Node {
    constructor(name, value) {
        super('Assignment');
        this.name = name;
        this.value = value;
    }
}

export class ArrayExpression extends Node {
    constructor(elements = []) {
        super('ArrayExpression');
        this.elements = elements;
    }
}

export class ObjectExpression extends Node {
    constructor(properties = []) {
        super('ObjectExpression');
        this.properties = properties;
    }
}

export class PropertyDefinition extends Node {
    constructor(key, value) {
        super('PropertyDefinition');
        this.key = key;
        this.value = value;
    }
}

export class PropertyKey extends Node {
    constructor(value) {
        super('PropertyKey');
        this.value = value;
    }
}

export class ArrowFunctionExpression extends Node {
    constructor(params, body, isAsync = false) {
        super('ArrowFunctionExpression');
        this.params = params;
        this.body = body;
        this.isAsync = isAsync;
    }
}

export class TernaryExpression extends Node {
    constructor(condition, thenExpr, elseExpr) {
        super('TernaryExpression');
        this.condition = condition;
        this.thenExpr = thenExpr;
        this.elseExpr = elseExpr;
    }
}

export class AssignmentExpression extends Node {
    constructor(left, operator, right) {
        super('AssignmentExpression');
        this.left = left;
        this.operator = operator;
        this.right = right;
    }
}

export class CompoundAssignmentExpression extends Node {
    constructor(left, operator, right) {
        super('CompoundAssignmentExpression');
        this.left = left;
        this.operator = operator;
        this.right = right;
    }
}

export class BitwiseExpression extends Node {
    constructor(operator, left, right) {
        super('BitwiseExpression');
        this.operator = operator;
        this.left = left;
        this.right = right;
    }
}

export class TemplateLiteral extends Node {
    constructor(expressions, quasis) {
        super('TemplateLiteral');
        this.expressions = expressions;
        this.quasis = quasis;
    }
}

export class AwaitExpression extends Node {
    constructor(argument) {
        super('AwaitExpression');
        this.argument = argument;
    }
}

export class ArrayPattern extends Node {
    constructor(elements) {
        super('ArrayPattern');
        this.elements = elements || [];
    }
}

export class ObjectPattern extends Node {
    constructor(properties) {
        super('ObjectPattern');
        this.properties = properties || [];
    }
}

export class Property extends Node {
    constructor(key, value, computed = false) {
        super('Property');
        this.key = key;
        this.value = value;
        this.computed = computed;
    }
}

export class VariableDeclarationWithPattern extends Node {
    constructor(kind, pattern, initializer) {
        super('VariableDeclarationWithPattern');
        this.kind = kind; // 'let' or 'const'
        this.pattern = pattern;
        this.initializer = initializer;
    }
}

export class SpreadElement extends Node {
    constructor(argument) {
        super('SpreadElement');
        this.argument = argument;
    }
}

export class AssignmentPattern extends Node {
    constructor(left, right) {
        super('AssignmentPattern');
        this.left = left;
        this.right = right;
    }
}

export class RestElement extends Node {
    constructor(argument) {
        super('RestElement');
        this.argument = argument;
    }
}

export class ImportExpression extends Node {
    constructor(path) {
        super('ImportExpression');
        this.path = path;
    }
}

export class SequenceExpression extends Node {
    constructor(expressions) {
        super('SequenceExpression');
        this.expressions = expressions;
    }
}

// Импорт модуля (как инструкция)
export class ImportStatement extends Node {
    constructor(path, alias = null) {
        super('ImportStatement');
        this.path = path;
        this.alias = alias;  // Новое: имя переменной после "как"
    }
}

// Экспорт имен
export class ExportStatement extends Node {
    constructor(identifiers = []) {
        super('ExportStatement');
        this.identifiers = identifiers;
    }
}

export class SwitchStatement extends Node {
    constructor(discriminant, cases, defaultCase) {
        super('SwitchStatement');
        this.discriminant = discriminant;  // The switch expression
        this.cases = cases;                // Array of case objects
        this.defaultCase = defaultCase;    // Default case or null
    }
}

// Экспорт всех узлов
export const ASTNodes = {
    Node,
    Program,
    ExpressionStatement,
    EmptyStatement,
    LetStatement,
    ConstStatement,
    ReturnStatement,
    BlockStatement,
    IfStatement,
    WhileStatement,
    ForStatement,
    BreakStatement,
    ContinueStatement,
    FunctionDeclaration,
    ClassMethod,
    ClassDeclaration,
    TryStatement,
    ThrowStatement,
    Literal,
    Identifier,
    ThisExpression,
    SuperExpression,
    NewExpression,
    BinaryExpression,
    UnaryExpression,
    CallExpression,
    MemberExpression,
    MemberAssignment,
    Assignment,
    AssignmentExpression,
    CompoundAssignmentExpression,
    BitwiseExpression,
    TemplateLiteral,
    ArrayExpression,
    ObjectExpression,
    PropertyDefinition,
    PropertyKey,
    ArrowFunctionExpression,
    TernaryExpression,
    ImportStatement,
    ImportExpression,
    ExportStatement,
    SwitchStatement,
    AwaitExpression,
    ArrayPattern,
    ObjectPattern,
    Property,
    VariableDeclarationWithPattern,
    SpreadElement,
    AssignmentPattern,
    RestElement,
    SequenceExpression
};


export default ASTNodes;
