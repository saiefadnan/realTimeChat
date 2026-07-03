export default async function fetchData(url, reqData) {
    try {
        // Automatically include token from cookies for authMiddleware
        const token = Cookies.get('token');
        const bodyWithToken = { ...reqData, token };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-type': 'application/json'
            },
            body: JSON.stringify(bodyWithToken)
        });

        if (!response.ok) {
            throw new Error(`Network Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fetch Failed:', error);
        throw error; // Rethrow so caller can handle errors
    }
}