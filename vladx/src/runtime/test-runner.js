/**
 * TestRunner — Фреймворк для тестирования
 */

import { VladXObject } from './vladx-object.js';

export class TestRunner {
    constructor() {
        this.suites = [];
        this.currentSuite = null;
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            suites: []
        };
        this.assertions = this.createAssertions();
    }

    /**
     * Создать группу тестов
     */
    describe(name, callback) {
        const suite = {
            name,
            tests: [],
            beforeEach: [],
            afterEach: []
        };

        this.suites.push(suite);
        const parentSuite = this.currentSuite;
        this.currentSuite = suite;

        callback();

        this.currentSuite = parentSuite;
    }

    /**
     * Создать тест
     */
    it(name, callback, options = {}) {
        if (!this.currentSuite) {
            throw new Error('Test must be inside a describe block');
        }

        const test = {
            name,
            callback,
            skip: options.skip || false,
            only: options.only || false,
            timeout: options.timeout || 5000
        };

        this.currentSuite.tests.push(test);
    }

    /**
     * Пропустить тест
     */
    skip(name, callback) {
        this.it(name, callback, { skip: true });
    }

    /**
     * Запустить только этот тест
     */
    only(name, callback) {
        this.it(name, callback, { only: true });
    }

    /**
     * Before each
     */
    beforeEach(callback) {
        if (!this.currentSuite) {
            throw new Error('beforeEach must be inside a describe block');
        }
        this.currentSuite.beforeEach.push(callback);
    }

    /**
     * After each
     */
    afterEach(callback) {
        if (!this.currentSuite) {
            throw new Error('afterEach must be inside a describe block');
        }
        this.currentSuite.afterEach.push(callback);
    }

    /**
     * Запустить все тесты
     */
    async run() {
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            suites: []
        };

        // Запустить только тесты с .only
        const onlyTests = this.findOnlyTests();
        const suitesToRun = onlyTests.length > 0 ? this.getSuitesWithOnly() : this.suites;

        for (const suite of suitesToRun) {
            await this.runSuite(suite);
        }

        return this.results;
    }

    /**
     * Запустить suite
     */
    async runSuite(suite) {
        const suiteResult = {
            name: suite.name,
            tests: []
        };

        console.log(`\n${suite.name}`);

        for (const test of suite.tests) {
            const testResult = await this.runTest(suite, test);
            suiteResult.tests.push(testResult);

            if (testResult.skipped) {
                this.results.skipped++;
                console.log(`  ⊘ ${test.name} (skipped)`);
            } else if (testResult.passed) {
                this.results.passed++;
                console.log(`  ✓ ${test.name}`);
            } else {
                this.results.failed++;
                console.log(`  ✗ ${test.name}`);
                if (testResult.error) {
                    console.log(`    ${testResult.error.message}`);
                }
            }

            this.results.total++;
        }

        this.results.suites.push(suiteResult);
    }

    /**
     * Запустить тест
     */
    async runTest(suite, test) {
        const result = {
            name: test.name,
            passed: false,
            failed: false,
            skipped: test.skip,
            error: null
        };

        if (test.skip) {
            return result;
        }

        try {
            // Before each hooks
            for (const hook of suite.beforeEach) {
                await hook();
            }

            // Run test with timeout
            await Promise.race([
                test.callback(this.assertions),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout: ${test.timeout}ms`)), test.timeout)
                )
            ]);

            result.passed = true;
        } catch (error) {
            result.failed = true;
            result.error = error;
        } finally {
            // After each hooks
            for (const hook of suite.afterEach) {
                try {
                    await hook();
                } catch (e) {
                    console.error('Error in afterEach:', e);
                }
            }
        }

        return result;
    }

    /**
     * Создать assertions
     */
    createAssertions() {
        const assert = (condition, message) => {
            if (!condition) {
                throw new Error(message || 'Assertion failed');
            }
        };

        return {
            assert,

            equal: (actual, expected, message) => {
                assert(actual === expected, message || `Expected ${actual} to equal ${expected}`);
            },

            deepEqual: (actual, expected, message) => {
                assert(
                    JSON.stringify(actual) === JSON.stringify(expected),
                    message || `Expected ${JSON.stringify(actual)} to deeply equal ${JSON.stringify(expected)}`
                );
            },

            notEqual: (actual, expected, message) => {
                assert(actual !== expected, message || `Expected ${actual} to not equal ${expected}`);
            },

            throws: async (fn, message) => {
                let threw = false;
                try {
                    await fn();
                } catch (e) {
                    threw = true;
                }
                assert(threw, message || 'Expected function to throw');
            },

            doesNotThrow: async (fn, message) => {
                let threw = false;
                let error;
                try {
                    await fn();
                } catch (e) {
                    threw = true;
                    error = e;
                }
                assert(!threw, message || `Expected function not to throw, but threw: ${error?.message}`);
            },

            isTrue: (value, message) => {
                assert(value === true, message || `Expected ${value} to be true`);
            },

            isFalse: (value, message) => {
                assert(value === false, message || `Expected ${value} to be false`);
            },

            isNull: (value, message) => {
                assert(value === null, message || `Expected ${value} to be null`);
            },

            isNotNull: (value, message) => {
                assert(value !== null, message || `Expected ${value} to not be null`);
            },

            isUndefined: (value, message) => {
                assert(value === undefined, message || `Expected ${value} to be undefined`);
            },

            isDefined: (value, message) => {
                assert(value !== undefined, message || `Expected ${value} to be defined`);
            },

            contains: (array, item, message) => {
                assert(array.includes(item), message || `Expected ${array} to contain ${item}`);
            },

            notContains: (array, item, message) => {
                assert(!array.includes(item), message || `Expected ${array} to not contain ${item}`);
            },

            hasProperty: (object, property, message) => {
                assert(property in object, message || `Expected object to have property ${property}`);
            },

            typeOf: (value, type, message) => {
                assert(
                    typeof value === type,
                    message || `Expected ${value} to be of type ${type}`
                );
            },

            instanceOf: (value, constructor, message) => {
                assert(
                    value instanceof constructor,
                    message || `Expected ${value} to be instance of ${constructor.name}`
                );
            },

            lengthOf: (array, length, message) => {
                assert(
                    array.length === length,
                    message || `Expected array to have length ${length}`
                );
            },

            greaterThan: (value, expected, message) => {
                assert(value > expected, message || `Expected ${value} to be greater than ${expected}`);
            },

            lessThan: (value, expected, message) => {
                assert(value < expected, message || `Expected ${value} to be less than ${expected}`);
            },

            matches: (string, regex, message) => {
                assert(regex.test(string), message || `Expected ${string} to match ${regex}`);
            },

            fail: (message) => {
                throw new Error(message || 'Test failed');
            },

            snapshot: (value, name) => {
                // Simplified snapshot testing
                const snapshotKey = `${name}`;
                console.log(`Snapshot: ${snapshotKey}`, JSON.stringify(value, null, 2));
            }
        };
    }

    /**
     * Найти тесты с .only
     */
    findOnlyTests() {
        const onlyTests = [];
        for (const suite of this.suites) {
            for (const test of suite.tests) {
                if (test.only) {
                    onlyTests.push(test);
                }
            }
        }
        return onlyTests;
    }

    /**
     * Получить suites с тестами .only
     */
    getSuitesWithOnly() {
        const suitesWithOnly = [];
        for (const suite of this.suites) {
            if (suite.tests.some(test => test.only)) {
                suitesWithOnly.push(suite);
            }
        }
        return suitesWithOnly;
    }

    /**
     * Получить результаты в формате JSON
     */
    getResultsJSON() {
        return JSON.stringify(this.results, null, 2);
    }

    /**
     * Получить результаты в формате JUnit XML
     */
    getResultsJUnit() {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n';

        for (const suite of this.results.suites) {
            const suiteFailed = suite.tests.some(t => t.failed);
            xml += `  <testsuite name="${suite.name}" tests="${suite.tests.length}" failures="${suite.tests.filter(t => t.failed).length}" skipped="${suite.tests.filter(t => t.skipped).length}">\n`;

            for (const test of suite.tests) {
                if (test.skipped) {
                    xml += `    <testcase name="${test.name}">\n      <skipped/>\n    </testcase>\n`;
                } else if (test.failed) {
                    xml += `    <testcase name="${test.name}">\n      <failure message="${test.error?.message || 'Test failed'}"/>\n    </testcase>\n`;
                } else {
                    xml += `    <testcase name="${test.name}"/>\n`;
                }
            }

            xml += '  </testsuite>\n';
        }

        xml += '</testsuites>';
        return xml;
    }
}

export default TestRunner;
