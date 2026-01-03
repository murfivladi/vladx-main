#!/usr/bin/env node

/**
 * VladX Test Runner
 * Запускает тесты для проверки работоспособности языка
 */

import { spawn } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(dirname(fileURLToPath(import.meta.url)), 'examples');

const vladPath = join(__dirname, '..', 'bin', 'vlad.js');

// Тесты для запуска
const tests = [
    { name: 'Fibonacci', file: 'fibonacci.vx', required: true },
    { name: 'Basics', file: 'basics.vx', required: true },
    { name: 'Advanced', file: 'advanced.vx', required: false },
    { name: 'Performance', file: 'performance.vx', required: false }
];

let passed = 0;
let failed = 0;

function runTest(test) {
    return new Promise((resolve) => {
        console.log(`\n🧪 Запуск теста: ${test.name}`);
        
        const child = spawn('node', [vladPath, join(__dirname, test.file)], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
            process.stdout.write(data);
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
            process.stderr.write(data);
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ ${test.name}: ПРОЙДЕН`);
                passed++;
                resolve(true);
            } else {
                console.log(`❌ ${test.name}: ПРОВАЛЕН (код выхода: ${code})`);
                failed++;
                resolve(false);
            }
        });
        
        child.on('error', (error) => {
            console.log(`❌ ${test.name}: ОШИБКА - ${error.message}`);
            failed++;
            resolve(false);
        });
        
        // Таймаут 30 секунд
        setTimeout(() => {
            child.kill();
            console.log(`❌ ${test.name}: ТАЙМАУТ`);
            failed++;
            resolve(false);
        }, 30000);
    });
}

async function main() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║            VladX Test Suite                           ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    // Проверка наличия vlad
    if (!existsSync(vladPath)) {
        console.error('❌ Ошибка: vlad не найден. Сначала соберите проект.');
        process.exit(1);
    }
    
    // Запуск тестов
    for (const test of tests) {
        if (test.required || existsSync(join(__dirname, test.file))) {
            await runTest(test);
        }
    }
    
    // Итоги
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║                    ИТОГИ                               ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    console.log(`✅ Пройдено: ${passed}`);
    console.log(`❌ Провалено: ${failed}`);
    console.log(`📊 Всего: ${passed + failed}`);
    
    if (failed > 0) {
        console.log('\n⚠️  Некоторые тесты провалены!');
        process.exit(1);
    } else {
        console.log('\n🎉 Все тесты пройдены!');
        process.exit(0);
    }
}

main().catch((error) => {
    console.error('Критическая ошибка:', error);
    process.exit(1);
});
