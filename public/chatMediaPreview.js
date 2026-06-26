(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ChatMediaPreview = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    function getDrivePreviewUrl(fileId) {
        return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
    }

    function getDriveFileUrl(fileId) {
        return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
    }

    function buildDriveIframe(fileId, doc = document) {
        const iframe = doc.createElement('iframe');
        iframe.src = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
        iframe.className = 'chat-drive-preview';
        iframe.setAttribute('allow', 'autoplay');
        return iframe;
    }

    function buildDrivePreview(fileId, type, doc = document) {
        if (type === 'image') {
            const link = doc.createElement('a');
            link.href = getDriveFileUrl(fileId);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            const image = doc.createElement('img');
            image.src = getDrivePreviewUrl(fileId);
            image.alt = 'Shared GIF or image';
            image.className = 'chat-media-preview';
            image.loading = 'lazy';

            image.onerror = () => {
                const iframe = buildDriveIframe(fileId, doc);
                link.replaceWith(iframe);
            };

            link.appendChild(image);
            return link;
        }

        return buildDriveIframe(fileId, doc);
    }

    return {
        buildDriveIframe,
        buildDrivePreview,
        getDriveFileUrl,
        getDrivePreviewUrl
    };
});
