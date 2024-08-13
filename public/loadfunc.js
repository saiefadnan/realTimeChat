export default function loadPage(content){
    fetch(content)
    .then(response=>{
        if(!response.ok){
            throw new Error('Network status not good',response.statusText);
        }
        return response.text();
    })
    .then(data=>{
        document.getElementById('page').innerHTML=data;
        const script = document.createElement('script');
            const Script = content.replace('.html','.js');
            const existingScript = document.querySelector(`script[src="${Script}"]`);
            if(existingScript){
                existingScript.remove();
                //console.log('Old script removed!!');
            }
            script.src = `${Script}?v=${new Date().getTime()}`;
            script.onload = () => {
                //console.log('Script loaded successfully');
            };
            script.onerror = (error) => {
                console.error('Error loading script', error);
            };
            document.body.appendChild(script);
    })
    .catch(error=>{
        console.error('Content fetched failed',error);
    })
}