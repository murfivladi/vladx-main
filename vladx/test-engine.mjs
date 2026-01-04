import { VladXEngine } from './vladx/src/engine/vladx-engine.js';

const engine = new VladXEngine();

async function test() {
    try {
        const source = `
пусть x = 10 + 5;
печать("Результат:", x);
`;

        const result = await engine.execute(source);
        console.log('Успех! Результат:', result);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

test();
