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

    function buildDriveCard(fileId, type, doc = document) {
        const link = doc.createElement('a');
        link.href = getDriveFileUrl(fileId);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'chat-drive-card';

        const icon = type === 'video' ? '🎬' : type === 'image' ? '🖼️' : '📄';
        const label = type === 'video' ? 'View Video' : type === 'image' ? 'View Image' : 'View File';

        link.innerHTML = `
            <span class="drive-card-icon">${icon}</span>
            <span class="drive-card-text">${label}</span>
            <span class="drive-card-arrow">↗</span>
        `;
        return link;
    }

    function buildDrivePreview(fileId, type, doc = document) {
        if (type === 'image' || type === 'gif' || (type && type.startsWith('image'))) {
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

        return buildDriveCard(fileId, type, doc);
    }
    

    return {
        buildDriveIframe,
        buildDrivePreview,
        getDriveFileUrl,
        getDrivePreviewUrl
    };
});
