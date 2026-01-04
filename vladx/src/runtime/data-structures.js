/**
 * DataStructures — Структуры данных
 */

import { VladXObject } from './vladx-object.js';

export class Stack {
    constructor() {
        this.items = [];
    }

    push(item) {
        this.items.push(item);
    }

    pop() {
        if (this.items.length === 0) {
            throw new Error('Стек пуст');
        }
        return this.items.pop();
    }

    peek() {
        if (this.items.length === 0) {
            return null;
        }
        return this.items[this.items.length - 1];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }

    clear() {
        this.items = [];
    }

    toArray() {
        return [...this.items];
    }
}

export class Queue {
    constructor() {
        this.items = [];
    }

    enqueue(item) {
        this.items.push(item);
    }

    dequeue() {
        if (this.items.length === 0) {
            throw new Error('Очередь пуста');
        }
        return this.items.shift();
    }

    peek() {
        if (this.items.length === 0) {
            return null;
        }
        return this.items[0];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }

    clear() {
        this.items = [];
    }

    toArray() {
        return [...this.items];
    }
}

export class LinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }

    append(value) {
        const node = { value, next: null };

        if (!this.head) {
            this.head = node;
            this.tail = node;
        } else {
            this.tail.next = node;
            this.tail = node;
        }

        this.size++;
    }

    prepend(value) {
        const node = { value, next: this.head };

        if (!this.head) {
            this.tail = node;
        }

        this.head = node;
        this.size++;
    }

    remove(value) {
        if (!this.head) return false;

        if (this.head.value === value) {
            this.head = this.head.next;
            if (!this.head) this.tail = null;
            this.size--;
            return true;
        }

        let current = this.head;
        while (current.next) {
            if (current.next.value === value) {
                if (!current.next.next) {
                    this.tail = current;
                }
                current.next = current.next.next;
                this.size--;
                return true;
            }
            current = current.next;
        }

        return false;
    }

    contains(value) {
        let current = this.head;
        while (current) {
            if (current.value === value) return true;
            current = current.next;
        }
        return false;
    }

    toArray() {
        const result = [];
        let current = this.head;
        while (current) {
            result.push(current.value);
            current = current.next;
        }
        return result;
    }

    getSize() {
        return this.size;
    }

    isEmpty() {
        return this.size === 0;
    }

    clear() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }
}

export class PriorityQueue {
    constructor(comparator = (a, b) => a < b) {
        this.items = [];
        this.comparator = comparator;
    }

    enqueue(item, priority = 0) {
        const element = { item, priority };
        let added = false;

        for (let i = 0; i < this.items.length; i++) {
            if (this.comparator(priority, this.items[i].priority)) {
                this.items.splice(i, 0, element);
                added = true;
                break;
            }
        }

        if (!added) {
            this.items.push(element);
        }
    }

    dequeue() {
        if (this.items.length === 0) {
            throw new Error('Очередь пуста');
        }
        return this.items.shift().item;
    }

    peek() {
        if (this.items.length === 0) {
            return null;
        }
        return this.items[0].item;
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }

    clear() {
        this.items = [];
    }
}

export class SetCustom {
    constructor() {
        this.items = new Map();
    }

    add(value) {
        const key = JSON.stringify(value);
        if (!this.items.has(key)) {
            this.items.set(key, value);
        }
    }

    has(value) {
        const key = JSON.stringify(value);
        return this.items.has(key);
    }

    delete(value) {
        const key = JSON.stringify(value);
        return this.items.delete(key);
    }

    values() {
        return Array.from(this.items.values());
    }

    size() {
        return this.items.size;
    }

    isEmpty() {
        return this.items.size === 0;
    }

    clear() {
        this.items.clear();
    }

    union(otherSet) {
        const unionSet = new SetCustom();
        this.values().forEach(value => unionSet.add(value));
        otherSet.values().forEach(value => unionSet.add(value));
        return unionSet;
    }

    intersection(otherSet) {
        const intersectionSet = new SetCustom();
        this.values().forEach(value => {
            if (otherSet.has(value)) {
                intersectionSet.add(value);
            }
        });
        return intersectionSet;
    }

    difference(otherSet) {
        const differenceSet = new SetCustom();
        this.values().forEach(value => {
            if (!otherSet.has(value)) {
                differenceSet.add(value);
            }
        });
        return differenceSet;
    }

    isSubset(otherSet) {
        return this.values().every(value => otherSet.has(value));
    }
}

export class MapCustom {
    constructor() {
        this.items = new Map();
    }

    set(key, value) {
        const hashKey = JSON.stringify(key);
        this.items.set(hashKey, { key, value });
    }

    get(key) {
        const hashKey = JSON.stringify(key);
        const entry = this.items.get(hashKey);
        return entry ? entry.value : undefined;
    }

    has(key) {
        const hashKey = JSON.stringify(key);
        return this.items.has(hashKey);
    }

    delete(key) {
        const hashKey = JSON.stringify(key);
        return this.items.delete(hashKey);
    }

    keys() {
        return Array.from(this.items.values()).map(entry => entry.key);
    }

    values() {
        return Array.from(this.items.values()).map(entry => entry.value);
    }

    entries() {
        return Array.from(this.items.values()).map(entry => [entry.key, entry.value]);
    }

    size() {
        return this.items.size;
    }

    isEmpty() {
        return this.items.size === 0;
    }

    clear() {
        this.items.clear();
    }
}

export class TrieNode {
    constructor() {
        this.children = new Map();
        this.isEndOfWord = false;
    }
}

export class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(word) {
        let node = this.root;

        for (const char of word) {
            if (!node.children.has(char)) {
                node.children.set(char, new TrieNode());
            }
            node = node.children.get(char);
        }

        node.isEndOfWord = true;
    }

    search(word) {
        let node = this.root;

        for (const char of word) {
            if (!node.children.has(char)) {
                return false;
            }
            node = node.children.get(char);
        }

        return node.isEndOfWord;
    }

    startsWith(prefix) {
        let node = this.root;

        for (const char of prefix) {
            if (!node.children.has(char)) {
                return false;
            }
            node = node.children.get(char);
        }

        return true;
    }

    delete(word) {
        const deleteRecursive = (node, word, index) => {
            if (index === word.length) {
                if (!node.isEndOfWord) return false;
                node.isEndOfWord = false;
                return node.children.size === 0;
            }

            const char = word[index];
            const child = node.children.get(char);

            if (!child) return false;

            const shouldDeleteChild = deleteRecursive(child, word, index + 1);

            if (shouldDeleteChild) {
                node.children.delete(char);
                return node.children.size === 0 && !node.isEndOfWord;
            }

            return false;
        };

        deleteRecursive(this.root, word, 0);
    }

    getAllWords(prefix = '') {
        const words = [];
        let node = this.root;

        for (const char of prefix) {
            if (!node.children.has(char)) return words;
            node = node.children.get(char);
        }

        const collectWords = (currentNode, currentPrefix) => {
            if (currentNode.isEndOfWord) {
                words.push(currentPrefix);
            }

            for (const [char, child] of currentNode.children) {
                collectWords(child, currentPrefix + char);
            }
        };

        collectWords(node, prefix);
        return words;
    }
}

export class BinarySearchTree {
    constructor(compareFn = (a, b) => a - b) {
        this.root = null;
        this.compareFn = compareFn;
    }

    insert(value) {
        const newNode = { value, left: null, right: null };

        if (!this.root) {
            this.root = newNode;
        } else {
            this.insertNode(this.root, newNode);
        }
    }

    insertNode(node, newNode) {
        const comparison = this.compareFn(newNode.value, node.value);

        if (comparison < 0) {
            if (!node.left) {
                node.left = newNode;
            } else {
                this.insertNode(node.left, newNode);
            }
        } else {
            if (!node.right) {
                node.right = newNode;
            } else {
                this.insertNode(node.right, newNode);
            }
        }
    }

    search(value) {
        return this.searchNode(this.root, value);
    }

    searchNode(node, value) {
        if (!node) return null;

        const comparison = this.compareFn(value, node.value);

        if (comparison === 0) return node;
        if (comparison < 0) return this.searchNode(node.left, value);
        return this.searchNode(node.right, value);
    }

    inOrderTraversal(callback) {
        this.inOrderTraversalNode(this.root, callback);
    }

    inOrderTraversalNode(node, callback) {
        if (!node) return;

        this.inOrderTraversalNode(node.left, callback);
        callback(node.value);
        this.inOrderTraversalNode(node.right, callback);
    }

    preOrderTraversal(callback) {
        this.preOrderTraversalNode(this.root, callback);
    }

    preOrderTraversalNode(node, callback) {
        if (!node) return;

        callback(node.value);
        this.preOrderTraversalNode(node.left, callback);
        this.preOrderTraversalNode(node.right, callback);
    }

    postOrderTraversal(callback) {
        this.postOrderTraversalNode(this.root, callback);
    }

    postOrderTraversalNode(node, callback) {
        if (!node) return;

        this.postOrderTraversalNode(node.left, callback);
        this.postOrderTraversalNode(node.right, callback);
        callback(node.value);
    }

    min() {
        if (!this.root) return null;

        let node = this.root;
        while (node.left) {
            node = node.left;
        }
        return node.value;
    }

    max() {
        if (!this.root) return null;

        let node = this.root;
        while (node.right) {
            node = node.right;
        }
        return node.value;
    }

    remove(value) {
        this.root = this.removeNode(this.root, value);
    }

    removeNode(node, value) {
        if (!node) return null;

        const comparison = this.compareFn(value, node.value);

        if (comparison < 0) {
            node.left = this.removeNode(node.left, value);
        } else if (comparison > 0) {
            node.right = this.removeNode(node.right, value);
        } else {
            if (!node.left && !node.right) {
                return null;
            }

            if (!node.left) {
                return node.right;
            }

            if (!node.right) {
                return node.left;
            }

            const minRight = this.findMinNode(node.right);
            node.value = minRight.value;
            node.right = this.removeNode(node.right, minRight.value);
        }

        return node;
    }

    findMinNode(node) {
        while (node.left) {
            node = node.left;
        }
        return node;
    }

    toArray() {
        const result = [];
        this.inOrderTraversal(value => result.push(value));
        return result;
    }
}

export default {
    Stack,
    Queue,
    LinkedList,
    PriorityQueue,
    SetCustom,
    MapCustom,
    Trie,
    BinarySearchTree
};
