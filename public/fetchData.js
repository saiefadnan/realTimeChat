export default async function fetchData(url,reqData){
    try{
        const response = await fetch(url,{
            method: 'POST',
            headers: {
                'Content-type': 'application/json'
            },
            body: JSON.stringify(reqData)
        });
        if(!response)throw new Error('Not found');
        else if(!response.ok)throw new Error('Network Error');
        else{
            const data = await response.json();
            return data;
        }
    }catch(error){
        console.error('Fetch Failed',error);
    }
}