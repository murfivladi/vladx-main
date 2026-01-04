/**
 * SourceMapGenerator — Генерация source maps
 */

export class SourceMapGenerator {
    constructor(options = {}) {
        this.file = options.file || '';
        this.sourceRoot = options.sourceRoot || '';
        this.mappings = [];
        this.sources = new Set();
        this.names = new Set();
        this.generatedMappings = [];
        this.generatedLine = 1;
        this.generatedColumn = 0;
        this.lastGeneratedLine = 0;
        this.lastGeneratedColumn = 0;
        this.lastSourceLine = 0;
        this.lastSourceColumn = 0;
        this.lastNameIndex = 0;
        this.lastSourceIndex = 0;
    }

    /**
     * Добавить mapping
     */
    addMapping(mapping) {
        if (!mapping.generated) {
            throw new Error('Generated position is required');
        }

        if (!mapping.original && !mapping.name) {
            this.mappings.push(mapping);
            return;
        }

        if (!mapping.source) {
            throw new Error('Source is required for mapping with original or name');
        }

        this.sources.add(mapping.source);
        if (mapping.name) {
            this.names.add(mapping.name);
        }

        this.mappings.push({
            generated: {
                line: mapping.generated.line,
                column: mapping.generated.column
            },
            original: mapping.original ? {
                line: mapping.original.line,
                column: mapping.original.column
            } : null,
            source: mapping.source,
            name: mapping.name || null
        });
    }

    /**
     * Установить исходный контент
     */
    setSourceContent(source, content) {
        this.sourceContent = this.sourceContent || {};
        this.sourceContent[source] = content;
    }

    /**
     * Добавить source
     */
    addSource(source) {
        this.sources.add(source);
    }

    /**
     * Добавить имя
     */
    addName(name) {
        this.names.add(name);
    }

    /**
     * Сгенерировать source map
     */
    toString() {
        return JSON.stringify(this.toJSON());
    }

    /**
     * Получить JSON
     */
    toJSON() {
        const sources = Array.from(this.sources);
        const names = Array.from(this.names);

        const map = {
            version: 3,
            file: this.file,
            sourceRoot: this.sourceRoot,
            sources,
            names,
            mappings: this.encodeMappings(this.mappings)
        };

        if (this.sourceContent) {
            map.sourcesContent = sources.map(source =>
                this.sourceContent[source] || null
            );
        }

        return map;
    }

    /**
     * Кодировать mappings в base64 VLQ
     */
    encodeMappings(mappings) {
        let result = '';
        let lastGeneratedLine = 0;
        let lastGeneratedColumn = 0;
        let lastSourceIndex = 0;
        let lastSourceLine = 0;
        let lastSourceColumn = 0;
        let lastNameIndex = 0;

        mappings.sort((a, b) => {
            if (a.generated.line !== b.generated.line) {
                return a.generated.line - b.generated.line;
            }
            return a.generated.column - b.generated.column;
        });

        for (const mapping of mappings) {
            if (mapping.generated.line !== lastGeneratedLine) {
                const linesDiff = mapping.generated.line - lastGeneratedLine;
                for (let i = 0; i < linesDiff; i++) {
                    result += ';';
                }
                lastGeneratedLine = mapping.generated.line;
                lastGeneratedColumn = 0;
            } else if (result.length > 0) {
                result += ',';
            }

            // Generated column
            result += this.encodeVLQ(mapping.generated.column - lastGeneratedColumn);
            lastGeneratedColumn = mapping.generated.column;

            if (mapping.original) {
                const sourceIndex = this.sources.indexOf(mapping.source);
                result += this.encodeVLQ(sourceIndex - lastSourceIndex);
                lastSourceIndex = sourceIndex;

                result += this.encodeVLQ(mapping.original.line - 1 - lastSourceLine);
                lastSourceLine = mapping.original.line - 1;

                result += this.encodeVLQ(mapping.original.column - lastSourceColumn);
                lastSourceColumn = mapping.original.column;

                if (mapping.name !== null) {
                    const nameIndex = this.names.indexOf(mapping.name);
                    result += this.encodeVLQ(nameIndex - lastNameIndex);
                    lastNameIndex = nameIndex;
                }
            }
        }

        return result;
    }

    /**
     * Кодировать число в VLQ
     */
    encodeVLQ(value) {
        let VLQ_BASE_SHIFT = 5;
        let VLQ_BASE = 1 << VLQ_BASE_SHIFT;
        let VLQ_BASE_MASK = VLQ_BASE - 1;
        let VLQ_CONTINUATION_BIT = VLQ_BASE;

        let encoded = '';
        let sign = value < 0 ? 1 : 0;
        value = Math.abs(value);

        value = (value << 1) | sign;

        do {
            let digit = value & VLQ_BASE_MASK;
            value >>>= VLQ_BASE_SHIFT;

            if (value > 0) {
                digit |= VLQ_CONTINUATION_BIT;
            }

            encoded += this.base64Encode(digit);
        } while (value > 0);

        return encoded;
    }

    /**
     * Base64 кодирование
     */
    base64Encode(value) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        return chars[value];
    }
}

export default SourceMapGenerator;
