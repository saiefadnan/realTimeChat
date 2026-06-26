const {
    buildDrivePreview,
    getDriveFileUrl,
    getDrivePreviewUrl
} = require('../public/chatMediaPreview');

function createFakeDocument() {
    return {
        createElement(tagName) {
            return {
                tagName: tagName.toUpperCase(),
                children: [],
                attributes: {},
                appendChild(child) {
                    this.children.push(child);
                    return child;
                },
                replaceWith(replacement) {
                    this.replacement = replacement;
                },
                setAttribute(name, value) {
                    this.attributes[name] = value;
                }
            };
        }
    };
}

describe('chat media preview helpers', () => {
    test('builds direct Drive URLs with encoded file ids', () => {
        const fileId = 'gif id/with spaces';

        expect(getDrivePreviewUrl(fileId)).toBe(
            'https://drive.google.com/uc?export=view&id=gif%20id%2Fwith%20spaces'
        );
        expect(getDriveFileUrl(fileId)).toBe(
            'https://drive.google.com/file/d/gif%20id%2Fwith%20spaces/view'
        );
    });

    test('renders image and gif uploads as inline images', () => {
        const doc = createFakeDocument();
        const preview = buildDrivePreview('gif-file-id', 'image', doc);
        const image = preview.children[0];

        expect(preview.tagName).toBe('A');
        expect(preview.href).toBe('https://drive.google.com/file/d/gif-file-id/view');
        expect(preview.target).toBe('_blank');
        expect(preview.rel).toBe('noopener noreferrer');
        expect(image.tagName).toBe('IMG');
        expect(image.src).toBe('https://drive.google.com/uc?export=view&id=gif-file-id');
        expect(image.className).toBe('chat-media-preview');
        expect(image.alt).toBe('Shared GIF or image');
        expect(image.loading).toBe('lazy');
    });

    test('falls back to the Drive iframe preview when an inline image fails', () => {
        const doc = createFakeDocument();
        const preview = buildDrivePreview('gif-file-id', 'image', doc);
        const image = preview.children[0];

        image.onerror();

        expect(preview.replacement.tagName).toBe('IFRAME');
        expect(preview.replacement.src).toBe('https://drive.google.com/file/d/gif-file-id/preview');
        expect(preview.replacement.className).toBe('chat-drive-preview');
        expect(preview.replacement.attributes.allow).toBe('autoplay');
    });

    test('keeps non-image uploads in the Drive iframe preview', () => {
        const doc = createFakeDocument();
        const preview = buildDrivePreview('video-file-id', 'video', doc);

        expect(preview.tagName).toBe('IFRAME');
        expect(preview.src).toBe('https://drive.google.com/file/d/video-file-id/preview');
        expect(preview.className).toBe('chat-drive-preview');
        expect(preview.attributes.allow).toBe('autoplay');
    });
});
