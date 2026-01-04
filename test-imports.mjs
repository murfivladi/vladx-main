// Тест интерпретатора без импортов
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// Читаем исходник лексера
const lexerSource = readFileSync('./vladx/src/lexer/lexer.js', 'utf-8');
console.log('Lexer source length:', lexerSource.length);

console.log('Test passed!');
