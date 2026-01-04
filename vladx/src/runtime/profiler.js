/**
 * Profiler — Профилировщик производительности
 */

export class Profiler {
    constructor() {
        this.records = new Map();
        this.callCounts = new Map();
        this.currentCallStack = [];
        this.startTime = null;
        this.endTime = null;
        this.memorySamples = [];
        this.intervalId = null;
        this.hotspots = new Map();
    }

    /**
     * Начать профилирование
     */
    start(options = {}) {
        this.records.clear();
        this.callCounts.clear();
        this.currentCallStack = [];
        this.startTime = Date.now();
        this.endTime = null;
        this.memorySamples = [];
        this.hotspots.clear();

        if (options.sampleMemory) {
            const sampleInterval = options.sampleInterval || 100;
            this.intervalId = setInterval(() => {
                this.memorySamples.push({
                    timestamp: Date.now(),
                    heapUsed: process.memoryUsage().heapUsed,
                    heapTotal: process.memoryUsage().heapTotal
                });
            }, sampleInterval);
        }
    }

    /**
     * Завершить профилирование
     */
    stop() {
        this.endTime = Date.now();

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        return this.getResults();
    }

    /**
     * Начать измерение функции
     */
    enterFunction(functionName, filename, line) {
        const key = `${filename}:${functionName}`;

        this.currentCallStack.push({
            functionName,
            filename,
            line,
            key,
            startTime: Date.now()
        });

        this.callCounts.set(key, (this.callCounts.get(key) || 0) + 1);
    }

    /**
     * Завершить измерение функции
     */
    exitFunction() {
        if (this.currentCallStack.length === 0) {
            return;
        }

        const frame = this.currentCallStack.pop();
        const duration = Date.now() - frame.startTime;

        if (!this.records.has(frame.key)) {
            this.records.set(frame.key, {
                functionName: frame.functionName,
                filename: frame.filename,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                avgTime: 0,
                callCount: 0
            });
        }

        const record = this.records.get(frame.key);
        record.totalTime += duration;
        record.minTime = Math.min(record.minTime, duration);
        record.maxTime = Math.max(record.maxTime, duration);
        record.callCount = this.callCounts.get(frame.key);
        record.avgTime = record.totalTime / record.callCount;

        // Обновляем hotspots
        const hotspotKey = `${frame.filename}:${frame.line}`;
        this.hotspots.set(hotspotKey, (this.hotspots.get(hotspotKey) || 0) + duration);
    }

    /**
     * Получить результаты профилирования
     */
    getResults() {
        const totalTime = this.endTime ? this.endTime - this.startTime : 0;

        // Сортировка по total time
        const sortedRecords = Array.from(this.records.values())
            .sort((a, b) => b.totalTime - a.totalTime)
            .map(record => ({
                ...record,
                percentage: totalTime > 0 ? ((record.totalTime / totalTime) * 100).toFixed(2) + '%' : '0%'
            }));

        // Сортировка hotspots
        const sortedHotspots = Array.from(this.hotspots.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([location, time]) => ({
                location,
                time,
                percentage: totalTime > 0 ? ((time / totalTime) * 100).toFixed(2) + '%' : '0%'
            }));

        return {
            summary: {
                totalTime: totalTime + 'ms',
                functionCount: this.records.size,
                totalCalls: Array.from(this.callCounts.values()).reduce((a, b) => a + b, 0)
            },
            functions: sortedRecords,
            hotspots: sortedHotspots,
            memory: {
                samples: this.memorySamples,
                initial: this.memorySamples[0] || null,
                final: this.memorySamples[this.memorySamples.length - 1] || null,
                peak: this.memorySamples.reduce((max, sample) => 
                    sample.heapUsed > max.heapUsed ? sample : max, 
                    { heapUsed: 0 }
                )
            }
        };
    }

    /**
     * Получить данные о функциях в формате flame graph
     */
    getFlameGraphData() {
        return Array.from(this.records.values()).map(record => ({
            name: `${record.functionName} (${record.filename})`,
            value: record.totalTime,
            children: []
        }));
    }

    /**
     * Экспорт результатов в JSON
     */
    exportJSON() {
        return JSON.stringify(this.getResults(), null, 2);
    }

    /**
     * Экспорт результатов в формате для Flamegraph
     */
    exportFlamegraph() {
        const lines = [];

        for (const [key, record] of this.records) {
            lines.push(`${record.functionName} ${record.totalTime}`);
        }

        return lines.join('\n');
    }

    /**
     * Получить статистику по памяти
     */
    getMemoryStats() {
        if (this.memorySamples.length === 0) {
            return null;
        }

        const samples = this.memorySamples.map(s => s.heapUsed);
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

        return {
            min,
            max,
            avg,
            growth: this.memorySamples[this.memorySamples.length - 1].heapUsed - this.memorySamples[0].heapUsed,
            samples: this.memorySamples
        };
    }

    /**
     * Найти функции с высокой задержкой
     */
    findSlowFunctions(threshold = 100) {
        return Array.from(this.records.values())
            .filter(record => record.avgTime > threshold)
            .sort((a, b) => b.avgTime - a.avgTime);
    }

    /**
     * Найти функции с большим количеством вызовов
     */
    findFrequentFunctions(threshold = 100) {
        return Array.from(this.records.values())
            .filter(record => record.callCount > threshold)
            .sort((a, b) => b.callCount - a.callCount);
    }

    /**
     * Сравнить два профиля
     */
    static compare(profile1, profile2) {
        const results1 = profile1.getResults();
        const results2 = profile2.getResults();

        const comparison = {
            totalTime: {
                before: results1.summary.totalTime,
                after: results2.summary.totalTime,
                change: this.calculateChange(
                    parseInt(results1.summary.totalTime),
                    parseInt(results2.summary.totalTime)
                )
            },
            functions: []
        };

        // Сравнение функций
        const allFunctions = new Set([
            ...results1.functions.map(f => f.functionName),
            ...results2.functions.map(f => f.functionName)
        ]);

        for (const funcName of allFunctions) {
            const func1 = results1.functions.find(f => f.functionName === funcName);
            const func2 = results2.functions.find(f => f.functionName === funcName);

            comparison.functions.push({
                name: funcName,
                before: func1 ? func1.totalTime : 0,
                after: func2 ? func2.totalTime : 0,
                change: this.calculateChange(
                    func1 ? func1.totalTime : 0,
                    func2 ? func2.totalTime : 0
                )
            });
        }

        comparison.functions.sort((a, b) => b.after - a.after);

        return comparison;
    }

    /**
     * Рассчитать изменение
     */
    static calculateChange(before, after) {
        if (before === 0) return after > 0 ? '+∞' : '0%';
        const change = ((after - before) / before * 100).toFixed(2);
        return change > 0 ? `+${change}%` : `${change}%`;
    }

    /**
     * Очистить данные
     */
    clear() {
        this.records.clear();
        this.callCounts.clear();
        this.currentCallStack = [];
        this.startTime = null;
        this.endTime = null;
        this.memorySamples = [];
        this.hotspots.clear();

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

export default Profiler;
